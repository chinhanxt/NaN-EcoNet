"""Print reference transcript words inside [start, end] source seconds.

usage: reference-range.py REFERENCE.json START END > ref.txt
REFERENCE.json holds {"segments": [{"words": [{"word", "start", "end"}, ...]}, ...]}.
A word is included when its midpoint lies inside the range.
"""
import json
import sys

path, start, end = sys.argv[1], float(sys.argv[2]), float(sys.argv[3])
data = json.load(open(path, encoding='utf-8'))
words = [w for segment in data.get('segments', []) for w in segment.get('words', [])]
picked = [str(w['word']).strip() for w in words if start <= (float(w['start']) + float(w['end']))/2 <= end]
print(' '.join(word for word in picked if word))
