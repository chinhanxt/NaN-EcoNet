import {Config} from '@remotion/cli/config';

// Node render APIs must pass their options separately.
Config.setVideoImageFormat('png');
Config.setCodec('h264');
Config.setPixelFormat('yuv420p');
Config.setColorSpace('bt709');
Config.setCrf(18);
Config.setOverwriteOutput(true);
