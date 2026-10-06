"""Deterministic, resumable rendering of an approved decision plan."""
import contextlib
import fcntl
import os
import shutil
from pathlib import Path
import checkpoints
import contracts
import analysis
import rendering
import revisions
import timelines
import recut


def _valid_saved(directory, clip):
    try:
        return (checkpoints.artifact(directory,clip['path'],clip['sha256']) and
                checkpoints.artifact(directory,clip['cleanPath'],clip['cleanSha256']))
    except (OSError,KeyError,ValueError):
        return False


def _narration(request, plan=None):
    if request.get('audio',{}).get('mode')!='replace-narration' or not request.get('captions',{}).get('enabled'):
        return None
    timings=request.get('audio',{}).get('narrationCaptions',request.get('narrationCaptions'))
    if timings is not None:
        duration=rendering.audio_duration(request['audio']['narrationPath'])
        if not timings or any(t['endMs']/1000>duration+.15 for t in timings):
            raise ValueError('Generated narration caption timings do not fit staged narration audio')
        return {'language':'und','segments':[{'start':t['startMs']/1000,'end':t['endMs']/1000,'text':t['text'],
            'words':[{'word':t['text'],'start':t['startMs']/1000,'end':t['endMs']/1000}]} for t in timings],
            'timingSource':'generated-narration-phrases'}
    from pipeline import transcribe_released
    transcript=transcribe_released(request['audio']['narrationPath'])
    if not any(s.get('words') for s in transcript.get('segments',[])):
        raise ValueError('Replacement narration has no word timings for captions')
    from narration_reference import reference_transcript
    if request.get('audio', {}).get('narrationText'):
        return reference_transcript(transcript, request['audio']['narrationText'])
    # AGY-written narration: its script is the reference (strict 1:1, else sequence-aligned);
    # keep ASR words only if it cannot be aligned at all.
    clips = (plan or {}).get('clips') or [{}]
    generated = (((clips[0] or {}).get('content') or {}).get('narration') or {}).get('text')
    if isinstance(generated, str) and generated.strip():
        try:
            transcript = reference_transcript(transcript, generated.strip())
        except ValueError:
            pass
    return transcript


def compatible_effects(edits, decision):
    """Drop zoom edits over scenes whose framing already zooms or splits.

    FOCUS/INSET scenes already follow the active screen region, and a SPLIT stack has a
    seam a centre zoom would push the two faces across."""
    import edit_builder
    if not edits:
        return edits
    busy = [(s['startSeconds'], s['endSeconds']) for s in decision.get('scenes', [])
            if isinstance(s, dict) and s.get('strategy') in ('SPLIT', 'FOCUS', 'INSET')]
    return [e for e in edits if not (edit_builder.EFFECT_LIMITS.get(e.get('type'), {}).get('zoom')
            and any(e['start'] < b and e['end'] > a for a, b in busy))]

def _remap_parent_scenes(parent_scenes, segments):
    """Parent layout scenes seen through the revision cut; legacy scenes without a strategy are skipped."""
    import layout_ranges
    mapped = layout_ranges.remap([
        {'start':s.get('startSeconds'),'end':s.get('endSeconds'),'layout':s.get('strategy')}
        for s in parent_scenes or [] if isinstance(s,dict) and s.get('strategy')], segments)
    return [{'startSeconds':s['start'],'endSeconds':s['end'],'strategy':s['layout'].upper()} for s in mapped]


def _snap_to_speech(start, end, words):
    """Region times moved onto the narration that names it: the start onto the nearest phrase
    (else word) start and the end onto the nearest word end, each within 1.5 s; AGY times
    already on a word boundary (0.15 s) are kept."""
    starts=[w['start'] for w in words]
    if starts and not any(abs(t-start)<=.15 for t in starts):
        phrases=[w['start'] for i,w in enumerate(words) if i==0 or w['start']-words[i-1]['end']>=.25
                 or str(words[i-1].get('word','')).strip().endswith(tuple('.?!,;:'))]
        for pool in (phrases,starts):
            near=[t for t in pool if abs(t-start)<=1.5]
            if near:
                start=min(near,key=lambda t:abs(t-start)); break
    ends=[w['end'] for w in words if w['end']>=start+.8]
    if ends and not any(abs(t-end)<=.15 for t in ends):
        near=[t for t in ends if abs(t-end)<=1.5]
        if near: end=min(near,key=lambda t:abs(t-end))
    return start,end


def focus_regions(item, transcript=None):
    """Clip-local screen focus boxes (source-frame fractions) for FOCUS scenes: the AI's
    content.focusRegions, or screen-reading contentFocus only when there are none; times
    aligned to the narration that mentions each region."""
    chosen=[]
    for entry in ((item.get('content') or {}).get('focusRegions') or []):
        if isinstance(entry,dict):
            chosen.append({k:float(entry[k]) for k in ('start','end','x','y','w','h')})
    if not chosen:
        for entry in item.get('contentFocus') or []:
            if isinstance(entry,(list,tuple)) and len(entry)>=6:
                chosen.append(dict(zip(('start','end','x','y','w','h'),map(float,entry[:6]))))
    words=sorted((w for s in (transcript or {}).get('segments',[]) for w in s.get('words') or []
                  if w.get('end',0)>w.get('start',0)),key=lambda w:w['start'])
    regions=[]
    for region in sorted((r for r in chosen if r['end']>r['start'] and r['w']>0 and r['h']>0),key=lambda r:r['start']):
        start,end=_snap_to_speech(region['start'],region['end'],words) if words else (region['start'],region['end'])
        if regions and start<regions[-1]['end'] or end-start<.8:
            start,end=region['start'],region['end']
        if regions and start<regions[-1]['end']:
            continue
        regions.append({**region,'start':round(start,3),'end':round(end,3)})
    return regions


def _frame_source(request,source,segments,target,directory,layout,warnings,fps,content_ranges=None,runner=None,focus=None):
    """Cut source ranges and reframe them with the approved layout; returns the reframe decision."""
    cut=target.with_name(target.name.replace('-framed.mp4','-cut.mp4'))
    recut.run_cut_concat(str(source),segments,str(cut),str(directory),runner=runner or rendering.run,fps=fps)
    import active_speaker,split_layout,screencast_layout
    active_speaker.ENABLED=active_speaker.CUT_MODE=split_layout.ENABLED=layout=='speaker-cut'
    screencast_layout.ENABLED=layout=='screencast'
    return rendering.reframe(cut,target,request['aspectRatio'],layout,warnings,
                             request.get('cropOverrides'),content_ranges,focus)


def _without_loudnorm(command):
    """The cut argv minus its loudnorm, for audio that is already normalized (no second pass)."""
    from ffmpeg_utils import LOUDNORM_FILTER
    out=list(command)
    for index in range(len(out)-1):
        if out[index]=='-af' and out[index+1]==LOUDNORM_FILTER:
            return out[:index]+out[index+2:]
    return out


def _cut_seconds(ranges,fps):
    """Planned length of a CFR cut (whole frames at fps), not the container duration: AAC
    padding makes container durations run long and the drift adds up at every join."""
    from fractions import Fraction
    rate=Fraction(str(fps))
    return float(sum(round((Fraction(str(r['end']))-Fraction(str(r['start'])))*rate) for r in ranges)/rate)


def _hybrid(request,source,directory,identifier,item,plan,partial,warnings):
    """Parent clean pieces for time the base clip already framed; reframe only the new ranges.

    Returns (clean path, decision) or None when the pieces cannot be joined losslessly."""
    fps=rendering.cfr_rate(plan['media'])
    runs=[]
    for piece in partial['pieces']:
        if runs and runs[-1]['kind']==piece['kind']:
            runs[-1]['pieces'].append(piece)
        else:
            runs.append({'kind':piece['kind'],'pieces':[piece]})
    parent=request['reuse'].get('renderDecision',{}).get('scenes',[])
    # Same loudness as a full render: there every source range is normalized in its own cut
    # (recut.cut_commands), so the parent's clean pieces already are. New source ranges get that
    # same per-range cut; parent pieces and the re-cut of a normalized piece skip a second pass.
    plain=lambda command: rendering.run(_without_loudnorm(command))
    parts,scenes,offset=[],[],0.0
    for index,run in enumerate(runs):
        part=directory/(f'{identifier}-part{index}.mp4')
        if run['kind']=='clean':
            ranges=[{'start':p['cleanStart'],'end':p['cleanEnd']} for p in run['pieces']]
            recut.run_cut_concat(partial['path'],ranges,str(part),str(directory),runner=plain,fps=fps)
            found=_remap_parent_scenes(parent,ranges)
        else:
            ranges=[{'start':p['start'],'end':p['end']} for p in run['pieces']]
            framed=directory/(f'{identifier}-part{index}-framed.mp4')
            decided=_frame_source(request,source,ranges,framed,directory,item['layout'],warnings,fps)
            mixed=rendering.audio_mix(framed,directory/(f'{identifier}-part{index}-audio.mp4'),request.get('audio',{}))
            # Same intermediate encode as the parent pieces so the join is a stream copy.
            recut.run_cut_concat(str(mixed),[{'start':0,'end':_cut_seconds(ranges,fps)}],str(part),
                                 str(directory),runner=plain,fps=fps)
            found=[{k:v for k,v in s.items() if k in ('startSeconds','endSeconds','strategy')}
                   for s in decided.get('scenes',[]) if isinstance(s,dict)]
        info=rendering.probe(part)
        parts.append((part,info))
        scenes+=[{**s,'startSeconds':round(s['startSeconds']+offset,3),'endSeconds':round(s['endSeconds']+offset,3)}
                 for s in found]
        offset+=_cut_seconds(ranges,fps)
    if len({(i['width'],i['height'],i['audio']) for _,i in parts})!=1:
        return None
    clean=directory/(identifier+'-clean.mp4')
    listing=directory/(identifier+'-parts.txt')
    listing.write_text(''.join(f"file '{os.path.abspath(p)}'\n" for p,_ in parts))
    rendering.run(recut.concat_command(str(listing),str(clean)))
    return clean,{'engine':'hybrid-clean-recut','scenes':scenes,
                  'pieces':[{k:p[k] for k in ('kind','start','end')} for p in partial['pieces']]}


def render(request,source,directory,plan,emit):
    # One writer per attempt directory; a repository lease alone is not authority.
    with open(directory/'render.lock','a') as file:
        try:
            fcntl.flock(file,fcntl.LOCK_EX|fcntl.LOCK_NB)
        except BlockingIOError as error:
            raise RuntimeError('Another worker is rendering in this job directory') from error
        return _render(request,source,directory,plan,emit)


def _render(request,source,directory,plan,emit):
    from pipeline import _captions,_caption_filter,_hook,_effects
    fingerprint=checkpoints.digest({'plan':plan,'settings':checkpoints.settings(request),
                                    'audioArtifacts':checkpoints.audio_fingerprints(request)})
    checkpoint=directory/'render-checkpoint.json'
    saved=checkpoints.load(checkpoint,fingerprint) or {'clips':[],'warnings':list(plan.get('warnings',[]))}
    completed={c['clipId']:c for c in saved['clips'] if _valid_saved(directory,c)}
    warnings=saved['warnings']
    if len(completed)<len(plan['clips']) and request.get('audio',{}).get('mode')=='replace-narration' and request.get('captions',{}).get('enabled'):
        emit({'type':'progress','stage':'aligning-narration','progress':40})
    narration=_narration(request,plan) if len(completed)<len(plan['clips']) else None
    clips=[]
    span=48/len(plan['clips'])
    def step(stage,index,fraction):
        # Absolute, monotonic job progress: analysis owns 0..39, render 40..88, then 'rendered' at 90.
        emit({'type':'progress','stage':stage,'progress':40+span*(index+fraction),
              'clip':index+1,'clips':len(plan['clips'])})
    for index,item in enumerate(plan['clips']):
        identifier=item['clipId']
        if identifier in completed:
            step('render-checkpoint-restored',index,1)
            clips.append(completed[identifier])
            continue
        segments=contracts.segments(item['segments'],plan['media']['duration'],max_total=21600)
        reuse=revisions.candidate(request,plan['sourceFingerprint'],item['layout'],segments)
        current_request={**request,'layout':item['layout'],'effects':item.get('effects',[]),'designBrief':None,
                         'hook':{**request.get('hook',{}),'text':item.get('hook')}}
        clean=directory/(identifier+'-clean.mp4')
        render_mode='source-render'
        decision={'engine':'canonical-clean-recut'}
        step('cutting',index,0)
        if reuse:
            recut.run_cut_concat(reuse['path'],reuse['segments'],str(clean),str(directory),runner=rendering.run)
            virtual=reuse['transcript']
            render_mode='clean-recut'
            parent=request['reuse']
            decision['scenes'] = _remap_parent_scenes(parent.get('renderDecision',{}).get('scenes',[]),
                                                      reuse['segments'])
            manifest=parent.get('renderDecision',{}).get('cropScenes')
            if segments == contracts.segments(parent['sourceSegments'],21600,max_total=21600) and manifest:
                decision['cropScenes']=manifest
            else:
                step('reframing',index,.15)
                # Crop indices belong to the source EDL, before framing/effects.
                crop_source=directory/(identifier+'-crop-source.mp4')
                recut.run_cut_concat(str(source),segments,str(crop_source),str(directory),runner=rendering.run,
                                     fps=rendering.cfr_rate(plan['media']))
                decision['cropScenes']=rendering.crop_scenes(crop_source,rendering.probe(crop_source))
        else:
            # Only new source time is reframed; time the base clip already framed keeps its decisions.
            partial=revisions.partial(request,plan['sourceFingerprint'],item['layout'],segments)
            if partial:
                step('reframing',index,.15)
                built=_hybrid(request,source,directory,identifier,item,plan,partial,warnings)
                if built:
                    clean,decision=built
                    reuse=partial
                    render_mode='hybrid-recut'
                    virtual=recut.virtual_transcript(plan.get('transcript',{}),segments)
                    crop_source=directory/(identifier+'-crop-source.mp4')
                    recut.run_cut_concat(str(source),segments,str(crop_source),str(directory),runner=rendering.run,
                                         fps=rendering.cfr_rate(plan['media']))
                    decision['cropScenes']=rendering.crop_scenes(crop_source,rendering.probe(crop_source))
        if not reuse:
            # A deliberate settings change (layout, aspect, effects...) or brand-new ranges are
            # expected full renders; warn only when reusable base work was lost.
            if revisions.lost(request,item['layout'],segments):
                warning='Clean revision cannot be reused for these base settings/source ranges; rendered original source'
                if warning not in warnings: warnings.append(warning)
            framed=directory/(identifier+'-framed.mp4')
            step('reframing',index,.15)
            virtual=recut.virtual_transcript(plan.get('transcript',{}),segments)
            decision=_frame_source(request,source,segments,framed,directory,item['layout'],warnings,
                                   rendering.cfr_rate(plan['media']),item.get('contentRanges'),
                                   focus=focus_regions(item,virtual))
            current_request={**current_request,'effects':compatible_effects(current_request.get('effects'),decision)}
            step('applying-effects',index,.55)
            edited=_effects(current_request,framed,directory/(identifier+'-effects.mp4'),virtual)
            step('mixing-audio',index,.62)
            audio=rendering.audio_mix(edited,directory/(identifier+'-audio.mp4'),request.get('audio',{}))
            shutil.copyfile(audio,clean)
        if narration is not None:
            virtual=recut.virtual_transcript(narration,[{'start':0,'end':recut.total_duration(segments)}])
            if narration.get('narrationAlignment'):
                virtual['narrationAlignment'] = narration['narrationAlignment']
                virtual['timingSource'] = narration['timingSource']
        if request.get('captions',{}).get('enabled') and not any(s.get('words') for s in virtual.get('segments',[])) and narration is not None:
            raise ValueError('Replacement narration has no word timings inside this clip; source captions cannot replace them')
        if request.get('captions',{}).get('enabled') and not any(s.get('words') for s in virtual.get('segments',[])) and plan['media']['audio'] and narration is None:
            # Approved edits can extend beyond a canonical transcript. Obtain actual source timings.
            from pipeline import _transcript
            step('transcribing',index,.65)
            virtual=recut.virtual_transcript(_transcript(source,plan['media'],True),segments)
        current=clean
        # The hook must reserve the seam band the SPLIT captions burned on top of it will use.
        split=[(s['startSeconds'],s['endSeconds']) for s in decision.get('scenes',[]) if s.get('strategy')=='SPLIT']
        captioned=request.get('captions',{}).get('enabled') and any(s.get('words') for s in virtual.get('segments',[]))
        if request.get('hook',{}).get('enabled'):
            if not item.get('hook'):
                raise ValueError('Approved plan is missing its hook decision; analyze again before rendering')
            step('hook-captions' if captioned else 'hook',index,.7)
            # Hook and captions burn in ONE encode; the caption file is the one the hook placement measured.
            also=((_caption_filter(current,virtual,request['captions'],directory,split_ranges=split),
                   directory/(identifier+'-captioned.mp4')) if captioned else None)
            current=_hook(current_request,item,current,directory/(identifier+'-hook.mp4'),virtual,
                          split_ranges=split,warnings=warnings,
                          scene_starts=[s['startSeconds'] for s in decision.get('scenes',[])],also=also)
        elif captioned:
            step('captions',index,.7)
            current=_captions(current,directory/(identifier+'-captioned.mp4'),virtual,
                              request['captions'],directory,split_ranges=split)
        step('encoding',index,.92)
        final=directory/(identifier+'.mp4')
        if current==clean:
            current=directory/(identifier+'-final.tmp.mp4')
            shutil.copyfile(clean,current)
        os.replace(current,final)
        output=rendering.probe(final)
        if abs(output['width']/output['height']-contracts.ASPECTS[request['aspectRatio']])>0.01:
            raise ValueError('Rendered aspect ratio does not match approved plan')
        clip={'clipId':identifier,'path':str(final),'cleanPath':str(clean),'title':item['title'],'content':item.get('content'),
              'segments':item['segments'],'durationSeconds':output['duration'],'aspectRatio':request['aspectRatio'],
              'transcript':virtual,'layout':item['layout'],'scenes':timelines.rebase_scenes(plan['scenes'],segments),
              'designDecision':{'version':1,'baseEffectsApplied':True,'overlaysAppliedToFinal':True,
                  'effects':request.get('reuse',{}).get('designDecision',{}).get('effects') if reuse else item.get('effects',[]),
                  'baseEffectsInherited':bool(reuse),'captions':request.get('captions',{}),
                  'hook':{**request.get('hook',{}),'text':item.get('hook'),'durationSeconds':__import__('pipeline').hook_duration(request.get('hook',{}),output['duration'])}},
              'renderMode':render_mode,'renderDecision':{**decision,'hookPlacement':item.get('hookPlacement')},'sourceFingerprint':plan['sourceFingerprint'],
              'baseFingerprint':checkpoints.base_fingerprint(request,item['layout']),
              'cleanSha256':checkpoints.file_hash(clean),'sha256':checkpoints.file_hash(final)}
        clips.append(clip)
        checkpoints.save(checkpoint,fingerprint,{'clips':clips,'warnings':warnings})
    emit({'type':'progress','stage':'rendered','progress':90})
    return {'type':'result','phase':'render','clips':clips,'warnings':warnings,
            'sourceFingerprint':plan['sourceFingerprint'],'engineFingerprint':plan['engineFingerprint']}
