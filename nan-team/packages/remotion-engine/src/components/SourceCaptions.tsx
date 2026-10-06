import React, {useEffect, useMemo, useState} from 'react';
import {cancelRender, continueRender, delayRender, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import type {SourceVideoProps} from '../types/source-video';
import {captionFont, captionMetrics, dimCaptionColor, sourceCaptionPages} from './source-caption-model';

/** Source-specific captions keep the AI storyboard subtitle defaults intact. */
export const SourceCaptions: React.FC<Pick<SourceVideoProps,'captions'|'captionStyle'|'captionAppearance'>> =
({captions, captionStyle, captionAppearance = {}}) => {
  const {fps, height} = useVideoConfig();
  const now = useCurrentFrame() / fps * 1000;
  const pages = useMemo(() => sourceCaptionPages(captions), [captions]);
  const font = captionFont(captionAppearance.fontName);
  const [handle] = useState(() => delayRender('Loading source caption font'));
  useEffect(() => {
    if (!captions.length) {continueRender(handle); return;}
    const source = font.file ? `url("${staticFile('fonts/' + font.file)}")` : `local("${font.requested}")`;
    const face = new FontFace(font.family, source, {weight:'700'});
    face.load().then((loaded) => {document.fonts.add(loaded); continueRender(handle);})
      .catch(() => cancelRender(new Error(`Source caption font is unavailable: ${font.requested}`)));
    return () => {document.fonts.delete(face);};
  }, [font.file, font.requested, font.family, captions.length, handle]);
  const page = pages.find((words) => now >= words[0].startMs && now < words[words.length - 1].endMs);
  if (!page) return null;
  const classic = captionStyle === 'classic';
  const appearance = captionAppearance;
  const metrics = captionMetrics(appearance, height);
  const position = appearance.position ?? 'bottom';
  const effects: Record<string,string> = {neon:'glow',pop:'pop',box:'box'};
  const effect = appearance.effect ?? (effects[captionStyle] ?? 'none');
  const color = appearance.fontColor ?? '#FFFFFF';
  const inactiveColor = classic ? color : dimCaptionColor(color, appearance.baseOpacity ?? 1);
  const highlight = appearance.highlightColor ?? '#FFD700';
  const borderColor = appearance.borderColor ?? '#000000';
  const opacity = appearance.bgOpacity ?? 0;
  const bg = appearance.bgColor ?? '#000000';
  const background = opacity > 0 ? `rgba(${[1,3,5].map((offset)=>parseInt(bg.slice(offset,offset+2),16)).join(',')},${opacity})` : 'transparent';
  return <div style={{position:'absolute',left:0,right:0,display:'flex',justifyContent:'center',
    ...(position === 'top' ? {top:metrics.margin} : position === 'middle'
      ? {top:'50%',transform:'translateY(-50%)'} : {bottom:metrics.margin})}}>
    <div style={{fontFamily:font.family,fontWeight:700,fontSize:metrics.fontSize,lineHeight:1.15,
      textAlign:'center',maxWidth:'95%',minWidth:0,backgroundColor:background,padding:opacity>0?metrics.scale:0,
      WebkitTextStroke:opacity>0?undefined:`${metrics.border}px ${borderColor}`,paintOrder:'stroke fill',
      color:inactiveColor}}>
      {page.map((word,index) => {
        // ASS events hold the active word through the gap before the next starts.
        const active = !classic && now >= word.startMs && now < (page[index+1]?.startMs ?? word.endMs);
        const coloredBorder = active && (effect === 'glow' || effect === 'box');
        const stroke = coloredBorder ? Math.max(effect==='box'?4:3,
          (opacity>0?1:Math.floor(appearance.borderWidth??2))+(effect==='box'?3:2))*metrics.scale : undefined;
        const elapsed = now-word.startMs;
        const pop = .9 + .18*Math.min(1,elapsed/110);
        return <React.Fragment key={`${word.startMs}-${index}`}>
          {index>0?' ':null}<span style={{display:'inline-block',maxWidth:'100%',overflowWrap:'anywhere',
            color:active?(coloredBorder?'#FFFFFF':highlight):inactiveColor,
            WebkitTextStroke:coloredBorder?`${stroke}px ${highlight}`:undefined,
            textShadow:active&&effect==='glow'?`0 0 ${4*metrics.scale}px ${highlight}`:undefined,
            transform:active&&effect==='pop'?`scale(${pop})`:undefined}}>
            {appearance.uppercase?word.text.toUpperCase():word.text}</span>
        </React.Fragment>;
      })}
    </div>
  </div>;
};
