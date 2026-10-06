import { agentUserMessageHtml } from '../../libraries/helpers/src/utils/agent.message.html';

describe('agent user message html',()=>{
 it('keeps typed markup literal instead of injecting it',()=>{
  const html=agentUserMessageHtml('Cắt <b>2</b> clip <img src=x onerror=alert(1)> & "giữ" <30s');
  expect(html).toBe('Cắt &lt;b&gt;2&lt;/b&gt; clip &lt;img src=x onerror=alert(1)&gt; &amp; &quot;giữ&quot; &lt;30s');
  expect(html).not.toMatch(/<(b|img)\b/);
 });
 it('renders every attached clip and image and hides MediaId lines',()=>{
  const html=agentUserMessageHtml('Làm clip\n[--Media--]Video: https://cdn.test/a.mp4?t=1&x=2\nMediaId: m1\nVideo: /uploads/b.mov\nMediaId: m2\nImage: https://cdn.test/c.png\n[--Media--]');
  expect(html.match(/<video /g)).toHaveLength(2);
  expect(html.match(/<img /g)).toHaveLength(1);
  expect(html).toContain('src="https://cdn.test/a.mp4?t=1&amp;x=2"');
  expect(html).not.toContain('MediaId');
  expect(html.startsWith('Làm clip\n<div')).toBe(true);
 });
 it('renders older .mov attachments labelled Image as video',()=>{
  expect(agentUserMessageHtml('[--Media--]Image: /uploads/old.mov[--Media--]')).toContain('<video ');
 });
 it('escapes attribute breakouts and drops non-item text inside a media block',()=>{
  const html=agentUserMessageHtml('[--Media--]Image: /a.png"onerror="alert(1)\n<script>x</script>\n[--Media--]');
  expect(html).toContain('src="/a.png&quot;onerror=&quot;alert(1)"');
  expect(html).not.toContain('<script');
 });
 it('strips the integrations context, including media markers inside it',()=>{
  const html=agentUserMessageHtml('Đăng bài\n[--integrations--]\nUse [{"name":"[--Media--]Image: /x.png[--Media--]"}]\n[--integrations--]');
  expect(html).toBe('Đăng bài\n');
 });
});
