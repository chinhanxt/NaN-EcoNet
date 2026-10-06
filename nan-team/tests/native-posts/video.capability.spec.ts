import 'reflect-metadata';
import { VideoManager } from '../../libraries/nestjs-libraries/src/videos/video.manager';
import { VideoAbstract } from '../../libraries/nestjs-libraries/src/videos/video.interface';

describe('registered video capability availability', () => {
  const original = Reflect.getMetadata('video', VideoAbstract);
  afterEach(() => {
    if (original === undefined) Reflect.deleteMetadata('video', VideoAbstract);
    else Reflect.defineMetadata('video', original, VideoAbstract);
  });
  it('blocks explicit identifiers for disabled providers before resolving or executing them', () => {
    const get = jest.fn();
    Reflect.defineMetadata('video', [{ identifier: 'image-text-slides', available: false, target: class {} }], VideoAbstract);
    const manager = new VideoManager({ get } as any);
    expect(manager.getAllVideos()).toEqual([]);
    expect(manager.getVideoByName('image-text-slides')).toBeUndefined();
    expect(manager.getVideoByName('unknown')).toBeUndefined();
    expect(get).not.toHaveBeenCalled();
  });
  it('resolves enabled registered providers for both discovery and execution', () => {
    const target = class {}; const instance = {};
    Reflect.defineMetadata('video', [{ identifier: 'enabled', available: true, target }], VideoAbstract);
    const get = jest.fn(() => instance);
    const manager = new VideoManager({ get } as any);
    expect(manager.getAllVideos()[0].identifier).toBe('enabled');
    expect(manager.getVideoByName('enabled')?.instance).toBe(instance);
    expect(get).toHaveBeenCalledWith(target, { strict: false });
  });
});
