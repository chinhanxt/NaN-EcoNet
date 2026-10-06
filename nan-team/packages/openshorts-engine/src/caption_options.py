"""Bounded caption appearance at the private worker boundary.

Public DTO/MCP and motion rendering must use the same contract before these
options are exposed to callers. Existing string presets remain compatible.
"""
import re

from contracts import CAPTION_STYLES, number

COLORS = ('fontColor', 'borderColor', 'highlightColor', 'bgColor')
BOUNDS = {'fontSize': (10, 200), 'borderWidth': (0, 10),
          'bgOpacity': (0, 1), 'baseOpacity': (0, 1)}
EFFECTS = {'none', 'glow', 'pop', 'box'}
AUTO_STYLES = ('karaoke', 'pop', 'neon', 'box')


def validate(options):
    if not isinstance(options, dict):
        raise ValueError('captions must be an object')
    if options.get('style', 'karaoke') not in CAPTION_STYLES:
        raise ValueError('unsupported captions style')
    if 'position' in options and options['position'] not in ('top', 'middle', 'bottom'):
        raise ValueError('unsupported captions position')
    if 'fontName' in options and (not isinstance(options['fontName'], str) or
            not re.fullmatch(r'[A-Za-z0-9 _-]{1,80}', options['fontName']) or
            not options['fontName'].strip()):
        raise ValueError('invalid captions fontName')
    for key in COLORS:
        if key in options and (not isinstance(options[key], str) or
                              not re.fullmatch(r'#[a-fA-F0-9]{6}', options[key])):
            raise ValueError('invalid captions ' + key)
    for key, (low, high) in BOUNDS.items():
        if key in options:
            number(options[key], 'captions ' + key, low, high)
    if 'effect' in options and options['effect'] not in EFFECTS:
        raise ValueError('unsupported captions effect')
    if 'uppercase' in options and not isinstance(options['uppercase'], bool):
        raise ValueError('invalid captions uppercase')
    return options


def renderer_options(options):
    options = validate({'style': options} if isinstance(options, str) else options)
    style = options.get('style', 'karaoke')
    mapping = {'position': 'alignment', 'fontSize': 'fontsize', 'fontName': 'font_name',
               'fontColor': 'font_color', 'borderColor': 'border_color',
               'borderWidth': 'border_width', 'highlightColor': 'highlight_color',
               'bgColor': 'bg_color', 'bgOpacity': 'bg_opacity',
               'baseOpacity': 'base_opacity', 'uppercase': 'uppercase', 'effect': 'effect'}
    values = {target: options[source] for source, target in mapping.items() if source in options}
    if style in AUTO_STYLES:
        # Upstream AUTO_CAPTION_STYLE is the default karaoke look; caller values win.
        from subtitles import AUTO_CAPTION_STYLE as auto
        for key in ('font_name', 'font_color', 'highlight_color', 'border_color',
                    'border_width', 'base_opacity', 'uppercase', 'max_chars', 'max_duration'):
            values.setdefault(key, auto[key])
        values.setdefault('fontsize', auto['font_size'])
        values.setdefault('effect', {'neon': 'glow', 'box': 'box'}.get(style, auto['effect']))
    values.setdefault('effect', 'none')
    return style, values
