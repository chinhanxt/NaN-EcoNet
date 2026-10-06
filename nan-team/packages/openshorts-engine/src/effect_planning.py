"""Shared bounds and normalization for standalone and combined effect decisions."""
import contracts
import edit_builder


def validate_effects(raw, duration):
    raw = raw or []
    if not isinstance(raw,list) or len(raw)>12:
        raise ValueError('effects must contain at most 12 edits')
    for edit in raw:
        if edit.get('type') not in edit_builder.EFFECT_LIMITS:
            raise ValueError('unsupported effect')
        contracts.number(edit.get('start'),'effect start',0,duration)
        contracts.number(edit.get('end'),'effect end',edit['start'],duration)
        contracts.number(edit.get('strength',0),'effect strength',0,1)
        for key in ('centerX','centerY'):
            if edit.get(key) is not None:
                contracts.number(edit[key],'effect '+key,0,1)
    return edit_builder.normalize_edits(raw,duration)


# AGY focus regions (screencast): where the viewer should look, for zoom/pan during render.
FOCUS_MAX_PER_MINUTE = 4
FOCUS_MIN_SECONDS, FOCUS_MAX_SECONDS = 0.8, 8.0
FOCUS_MIN_SIZE = 0.1  # smaller boxes would need > 10x zoom and blur the screen text


def validate_focus_regions(raw, duration, per_minute=FOCUS_MAX_PER_MINUTE):
    """Normalized focus regions and notes; invalid entries are dropped, never fatal.

    Each region: clip-local start/end within [0, duration] lasting 0.8-8 s, bbox x/y/w/h as
    fractions of the full source frame lying inside it (w, h >= 0.1). Regions never overlap
    in time (the earlier one wins) and at most per_minute regions per minute of clip are kept
    (at least one), so the render never jumps between zooms."""
    notes, regions = [], []
    for item in raw if isinstance(raw, list) else []:
        try:
            start = contracts.number(item.get('start'), 'focus start', 0, duration)
            end = min(float(contracts.number(item.get('end'), 'focus end', start, duration + 0.5)), duration)
            box = [contracts.number(item.get(key), 'focus ' + key, 0, 1) for key in ('x', 'y', 'w', 'h')]
        except (AttributeError, TypeError, ValueError):
            notes.append('Focus region dropped: invalid time or bbox')
            continue
        x, y, w, h = box
        if not FOCUS_MIN_SECONDS <= end - start <= FOCUS_MAX_SECONDS:
            notes.append('Focus region dropped: must last %.1f-%.0f s' % (FOCUS_MIN_SECONDS, FOCUS_MAX_SECONDS))
            continue
        if w < FOCUS_MIN_SIZE or h < FOCUS_MIN_SIZE or x + w > 1.001 or y + h > 1.001:
            notes.append('Focus region dropped: bbox outside the frame or too small')
            continue
        reason = ' '.join(str(item.get('reason') or '').split())[:160]
        regions.append({'start': round(start, 3), 'end': round(end, 3), 'x': round(x, 4), 'y': round(y, 4),
                        'w': round(min(w, 1 - x), 4), 'h': round(min(h, 1 - y), 4), 'reason': reason})
    regions.sort(key=lambda r: r['start'])
    kept, last_end = [], -1.0
    limit = max(1, int(per_minute * duration / 60.0))
    for region in regions:
        if region['start'] < last_end:
            notes.append('Focus region dropped: overlaps an earlier one')
            continue
        if len(kept) >= limit:
            notes.append('Focus regions capped at %d for this clip' % limit)
            break
        kept.append(region)
        last_end = region['end']
    return kept, notes
