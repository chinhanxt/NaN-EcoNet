# AI Video Generator Pipeline (Remotion + Edge-TTS + Visual Consistency) Implementation Plan

> Implementation và bằng chứng hiện tại: [báo cáo triển khai](2026-09-28-ai-video-generator-implementation.md).
> Các ví dụ và tên file dưới đây mô tả kế hoạch gốc; báo cáo ghi rõ những điều chỉnh thực tế.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Xây dựng hệ thống sản xuất video AI ngắn (TikTok/Reels/Shorts 9:16) hoàn toàn tự động, 0 đồng API key, tích hợp tại Tab 2 Agent: Tự động phân tích 1 ảnh đầu vào để nhân bản phong cách (Visual DNA), AI chia kịch bản chuẩn thời lượng (15s/30s/60s), giọng đọc tiếng Việt `edge-tts` khớp từng frame, và Remotion render video chuyên nghiệp.

**Architecture:** 
- **Remotion Video Engine:** Project Remotion khởi tạo độc lập bằng `npx create-video@latest` đặt tại `packages/remotion-engine`, chứa Composition 1080x1920 (9:16) hỗ trợ Ken Burns effect, phụ đề động kiểu TikTok (Karaoke bouncing words), và background music.
- **Backend Service:** NestJS module xử lý luồng AI: (1) Phân tích visual anchor ảnh gốc + sinh kịch bản cấu trúc scenes, (2) Điều phối sinh ảnh phụ trợ cùng phong cách, (3) Chạy `edge-tts` xuất file mp3 và vtt, tự động vi chỉnh tốc độ `--rate` để khớp đúng thời lượng mục tiêu, (4) Gọi Remotion renderer xuất file MP4 lưu vào `apps/backend/uploads`.
- **Frontend UI (Tab 2 Agent):** Nút "Tạo Video AI" trên thanh công cụ chat mở Modal "AI Video Studio" (Storyboard Wizard): Nhập ý tưởng, nạp ảnh mồi, chọn thời lượng mục tiêu, xem trước storyboard các cảnh, nghe thử voice, và bấm Render xuất video đính kèm thẳng vào bài đăng Agent.

**Tech Stack:** Remotion (React), TypeScript, Node.js / NestJS, `edge-tts` (Microsoft Neural TTS), FFmpeg, TailwindCSS, CopilotKit.

---

## Global Constraints

- **STRICT PROHIBITION ON PROJECT GIT:** Tuyệt đối không chạy lệnh `git commit`, `git push`, `git add` trên repository chính `/home/chinhan/MMO/NaN-Team`.
- **REMOTION INITIALIZATION:** Khởi tạo Remotion bằng `npx create-video@latest` (không dùng git clone repo ngoài) vào thư mục `packages/remotion-engine`.
- **API KEY INDEPENDENCE:** Không cần API key trả phí cho giọng đọc và render. Edge TTS cần mạng tới Microsoft; Remotion/FFmpeg render và xử lý audio local.
- **RATIO & FPS:** Video mặc định tỉ lệ 9:16 (1080x1920), 30 FPS.
- **TYPESAFE:** Toàn bộ code TypeScript phải pass `npx tsc --noEmit` với 0 lỗi.

---

## File Structure Plan

```
packages/
└── remotion-engine/                       # Remotion project khởi tạo bằng npx create-video@latest
    ├── package.json
    ├── remotion.config.ts
    ├── src/
    │   ├── Root.tsx                       # Đăng ký Composition
    │   ├── index.ts                       # Entry point
    │   ├── compositions/
    │   │   └── TikTokVideo.tsx            # Main Composition 9:16
    │   ├── components/
    │   │   ├── KenBurnsImage.tsx          # Hiệu ứng chuyển động ảnh mượt mà
    │   │   ├── TikTokSubtitles.tsx        # Phụ đề chữ nhảy từng từ (Karaoke)
    │   │   ├── AudioLayer.tsx             # Quản lý voice tracks + BGM ducking
    │   │   └── ProgressBar.tsx            # Thanh thời lượng ở chân video
    │   └── types/
    │       └── schema.ts                  # Zod schema cho input props của video

libraries/nestjs-libraries/src/
└── videos/
    ├── remotion/
    │   ├── remotion.service.ts            # Service gọi bundle & render MP4
    │   ├── tts.service.ts                 # Service điều khiển edge-tts & frame sync
    │   ├── storyboard.service.ts          # Service sinh kịch bản & Visual DNA prompts
    │   └── dto/
    │       └── ai.video.dto.ts            # DTO định nghĩa request tạo video
    └── video.module.ts                    # Đăng ký RemotionService

apps/backend/src/api/routes/
└── ai-video.controller.ts                 # REST API endpoints cho Video Studio & Agent

apps/frontend/src/components/
├── agents/
│   ├── ai-video-studio.modal.tsx          # Modal UI Studio Storyboard trực quan
│   └── agent.chat.tsx                     # Kích hoạt modal từ nút "Tạo Video AI"
└── media/
    └── media.component.tsx                # Liên kết nút "Tạo Video AI" với Studio Modal
```

---

## Detailed Task Breakdown

### Task 1: Khởi tạo Remotion Engine bằng `npx create-video@latest`

**Files:**
- Create: `packages/remotion-engine/package.json`
- Create: `packages/remotion-engine/remotion.config.ts`
- Create: `packages/remotion-engine/src/Root.tsx`
- Create: `packages/remotion-engine/src/types/schema.ts`

**Interfaces:**
- Consumes: Node.js, `npx create-video@latest`
- Produces: `packages/remotion-engine` package có thể render qua `@remotion/renderer`

- [x] **Step 1: Chạy lệnh khởi tạo Remotion template chuẩn**
  Khởi tạo Remotion package vào `packages/remotion-engine` bằng template blank/typescript:
  ```bash
  mkdir -p packages
  cd packages && npx --yes create-video@latest remotion-engine --template=blank --typescript
  ```

- [x] **Step 2: Cài đặt các gói phụ trợ cần thiết cho Remotion**
  Cài đặt `@remotion/paths`, `@remotion/subtitles` (nếu cần), và `@remotion/renderer` vào `packages/remotion-engine`:
  ```bash
  cd packages/remotion-engine && npm install @remotion/renderer @remotion/bundler @remotion/subtitles zod
  ```

- [x] **Step 3: Định nghĩa Zod Schema cho dữ liệu video (`schema.ts`)**
  Tạo file `packages/remotion-engine/src/types/schema.ts` quy định cấu trúc input props:
  - `scenes`: Array các cảnh gồm `{ imagePath: string, durationInFrames: number, text: string, keyword?: string }`
  - `audioPath`: Đường dẫn file voice gộp hoặc từng scene
  - `bgmPath`: Đường dẫn file nhạc nền
  - `bgmVolume`: Âm lượng nhạc nền (mặc định 0.15)
  - `fps`: 30
  - `width`: 1080
  - `height`: 1920

- [x] **Step 4: Kiểm tra build thử nghiệm Remotion engine**
  Chạy `npx remotion versions` hoặc `npm run build` trong `packages/remotion-engine` để xác nhận template hoạt động 100%.

---

### Task 2: Xây dựng Vietnamese TTS & Frame Calculator Service (`edge-tts`)

**Files:**
- Create: `libraries/nestjs-libraries/src/videos/remotion/tts.service.ts`
- Test: `libraries/nestjs-libraries/src/videos/remotion/tts.service.spec.ts`

**Interfaces:**
- Consumes: Câu thoại tiếng Việt, thời lượng mục tiêu (giây), giọng đọc (`vi-VN-HoaiMyNeural` hoặc `vi-VN-NamMinhNeural`)
- Produces: `{ audioPath: string, vttPath: string, durationInSeconds: number, durationInFrames: number, sceneTimestamps: SceneTiming[] }`

- [x] **Step 1: Viết test case cho `TtsService`**
  Tạo file `tts.service.spec.ts` kiểm tra:
  - Hàm tính toán số frame từ thời lượng audio: `seconds * 30 FPS = frames`.
  - Hàm tính tỷ lệ điều chỉnh `--rate` khi vượt quá thời lượng mong muốn.
  - Xử lý phân tách timestamp từ file `.vtt`.

- [x] **Step 2: Hiện thực `TtsService`**
  - Chạy tiến trình con (child process) thực thi `edge-tts`:
    ```ts
    const command = `edge-tts --voice ${voice} --rate=${rate} --text "${cleanText}" --write-media ${outputAudio} --write-subtitles ${outputVtt}`;
    ```
  - Đọc file `.vtt` để trích xuất timestamp xuất hiện của từng từ.
  - Sử dụng thư viện `music-metadata` để đo độ dài mili-giây chính xác của file MP3.
  - Nếu người dùng đặt `targetDuration`, tự động tính độ lệch và điều chỉnh `--rate` tự động nếu thời lượng chênh lệch quá 2 giây.

- [x] **Step 3: Chạy test xác nhận `TtsService` hoạt động hoàn hảo**
  Chạy `npx jest libraries/nestjs-libraries/src/videos/remotion/tts.service.spec.ts`.

---

### Task 3: Xây dựng AI Storyboard & Visual DNA Expansion Service

**Files:**
- Create: `libraries/nestjs-libraries/src/videos/remotion/storyboard.service.ts`
- Modify: `libraries/nestjs-libraries/src/openai/openai.service.ts`
- Create: `libraries/nestjs-libraries/src/videos/remotion/dto/ai.video.dto.ts`

**Interfaces:**
- Consumes: `{ topic: string, targetDuration: 15 | 30 | 60, seedImageUrl?: string, voice: string }`
- Produces: `{ title: string, visualDna: string, scenes: Array<{ sceneIndex: number, voiceText: string, imagePrompt: string, keywordHighlight: string }> }`

- [x] **Step 1: Xây dựng DTO và Thuật toán chia ngân sách từ ngữ (Word Budget)**
  - `15s`: 3 scenes, tổng 38-42 từ.
  - `30s`: 5 scenes, tổng 78-83 từ.
  - `60s`: 8 scenes, tổng 150-165 từ.

- [x] **Step 2: Viết logic trích xuất "Visual DNA" và sinh Prompt tương đồng**
  Trong `storyboard.service.ts`:
  - Nếu có `seedImageUrl`: Gửi prompt phân tích cấu trúc 4 yếu tố (Subject, Environment, Color Palette, Art Style).
  - Kết hợp Visual DNA làm hậu tố cố định cho tất cả các `imagePrompt` của từng scene.
  - Đảm bảo AI xuất kết quả dạng JSON Schema hợp lệ 100%.

- [x] **Step 3: Kết nối với bộ sinh ảnh hiện có (`_mediaService.generateImage`)**
  - Tự động duyệt qua mảng `scenes`:
    - Scene 1: Gán `seedImageUrl` của người dùng.
    - Scene 2..N: Gọi `generateImage` với `imagePrompt` đã tối ưu hóa Visual DNA để sinh ra các ảnh tương đồng.

---

### Task 4: Xây dựng Remotion Composition Components (Ken Burns, TikTok Subtitles)

**Files:**
- Create: `packages/remotion-engine/src/compositions/TikTokVideo.tsx`
- Create: `packages/remotion-engine/src/components/KenBurnsImage.tsx`
- Create: `packages/remotion-engine/src/components/TikTokSubtitles.tsx`
- Create: `packages/remotion-engine/src/components/AudioLayer.tsx`
- Modify: `packages/remotion-engine/src/Root.tsx`

**Interfaces:**
- Consumes: `schema.ts` Props
- Produces: Remotion Composition hoàn chỉnh xem được trên Player hoặc render ra file MP4

- [x] **Step 1: Xây dựng `KenBurnsImage.tsx`**
  - Sử dụng hook `useCurrentFrame()` và `interpolate()` của Remotion.
  - Tạo hiệu ứng phóng to từ từ: `scale: interpolate(frame, [0, duration], [1.0, 1.15])`.
  - Luân phiên đổi hướng pan (Scene chẵn trượt từ trái sang phải, Scene lẻ trượt từ phải sang trái).

- [x] **Step 2: Xây dựng `TikTokSubtitles.tsx`**
  - Nhận danh sách từ kèm start/end frame.
  - Hiển thị font chữ đậm phong cách TikTok (`font-black uppercase tracking-wider`).
  - Đổ bóng đen đậm (`text-stroke: 2px black`, `drop-shadow`).
  - Highlight từ đang được đọc bằng màu vàng (`#FACC15`) hoặc xanh neon (`#10B981`) với hiệu ứng scale 1.1x nhẹ.

- [x] **Step 3: Xây dựng `AudioLayer.tsx`**
  - Phát file voice chính xác theo từng frame của từng cảnh.
  - Chèn track nhạc nền (BGM) với `volume: 0.12`.

- [x] **Step 4: Lắp ráp vào `TikTokVideo.tsx` & đăng ký trong `Root.tsx`**
  - Dùng thẻ `<Series>` của Remotion để nối tuần tự các Scene:
    ```tsx
    <Series>
      {scenes.map((scene, i) => (
        <Series.Sequence key={i} durationInFrames={scene.durationInFrames}>
          <KenBurnsImage src={scene.imagePath} duration={scene.durationInFrames} />
          <TikTokSubtitles text={scene.text} keyword={scene.keyword} />
        </Series.Sequence>
      ))}
    </Series>
    ```

---

### Task 5: Xây dựng Remotion Service & API Backend

**Files:**
- Create: `libraries/nestjs-libraries/src/videos/remotion/remotion.service.ts`
- Create: `apps/backend/src/api/routes/ai-video.controller.ts`
- Modify: `libraries/nestjs-libraries/src/videos/video.module.ts`
- Modify: `apps/backend/src/api/api.module.ts`

**Interfaces:**
- Consumes: REST request từ Frontend
- Produces:
  - `POST /ai-video/generate-storyboard`: Trả về kịch bản + ảnh tương đồng các cảnh.
  - `POST /ai-video/render`: Render video và trả về link file `.mp4`.
  - `GET /ai-video/status/:jobId`: Trả về tiến độ render (0 - 100%).

- [x] **Step 1: Xây dựng `RemotionService`**
  - Sử dụng `@remotion/bundler` và `@remotion/renderer`:
    ```ts
    import { bundle } from '@remotion/bundler';
    import { renderMedia, selectComposition } from '@remotion/renderer';
    ```
  - Cấu hình output file path về thư mục `apps/backend/uploads/videos/`.
  - Tự động đăng ký file vào bảng `Media` của database Prisma để hiển thị trên kho media người dùng.

- [x] **Step 2: Viết `AiVideoController`**
  - Cung cấp các endpoint:
    - `generateStoryboard`: nhận topic, targetDuration, seedImage -> sinh scenes + ảnh gợi ý.
    - `previewVoice`: trả về audio đọc thử 1 câu thoại ngắn.
    - `renderVideo`: chạy background job render Remotion và trả về `jobId`.

- [x] **Step 3: Đăng ký Controller và Provider vào AppModule**
  Cập nhật `video.module.ts` và `api.module.ts`.

---

### Task 6: Tích hợp Giao diện "AI Video Studio" vào Tab 2 Agent

**Files:**
- Create: `apps/frontend/src/components/agents/ai-video-studio.modal.tsx`
- Modify: `apps/frontend/src/components/agents/agent.chat.tsx`
- Modify: `apps/frontend/src/components/media/media.component.tsx`

**Interfaces:**
- Consumes: Nút "Tạo Video AI" trên khung chat
- Produces: Popup Modal 2 bước (Cấu hình -> Storyboard Preview -> Render Video -> Đính kèm vào Chat)

- [x] **Step 1: Thiết kế giao diện Modal `ai-video-studio.modal.tsx`**
  - **Phần 1: Setup ban đầu**
    - Input chủ đề / ý tưởng video.
    - Upload ảnh mồi (Seed image) hoặc checkbox *"Để AI tự vẽ toàn bộ ảnh"*.
    - Nút chọn thời lượng: `15s` (Hook) | `30s` (Chuẩn TikTok) | `60s` (Kể chuyện).
    - Dropdown chọn giọng: `Hoài My (Nữ)` | `Nam Minh (Nam)`.
    - Nút bấm: *"✨ Tạo kịch bản & Sinh ảnh"*.
  - **Phần 2: Storyboard Review**
    - Hiển thị danh sách card các cảnh (Scenes):
      - Cột ảnh: Ảnh xem trước (có nút 🔄 *Vẽ lại ảnh này*).
      - Cột thoại: Textarea cho phép sửa câu thoại + nút 🔊 *Nghe thử*.
    - Nút bấm chính: *"🚀 Render Video Ngay"*.
  - **Phần 3: Trạng thái & Kết quả**
    - Progress bar hiển thị tiến độ render.
    - Khi xong: Video player xem trước + Nút *"Gửi vào bài đăng Agent"* (tự động điền link video vào khung chat để lên lịch đăng bài).

- [x] **Step 2: Kết nối nút "Tạo Video AI" trên khung chat vào Modal mới**
  Trong `apps/frontend/src/components/agents/agent.chat.tsx` và `media.component.tsx`:
  - Thay thế trigger cũ của nút "Tạo Video AI" để mở `AiVideoStudioModal`.

---

### Task 7: End-to-End Verification & TDD Check

**Files:**
- Test execution scripts: `scripts/test-video-pipeline.cjs`, `scripts/test-video-studio-browser.cjs`

- [x] **Step 1: Chạy kiểm tra TypeScript trên toàn bộ repo**
  ```bash
  npx tsc --noEmit -p apps/backend/tsconfig.json
  npx tsc --noEmit -p apps/frontend/tsconfig.json
  ```
  Xác nhận 0 lỗi biên dịch.

- [ ] **Step 2: Chạy thử luồng tạo video 30 giây thực tế**
  - Input kiểm thử thực tế: 1 ảnh mồi sinh bởi AGY CLI + Topic: "Một buổi sáng xanh ở Sài Gòn" + Độ dài: 30s.
  - Xác nhận:
    1. AI sinh đúng 5 scenes.
    2. Các ảnh sinh thêm tương đồng phong cách và màu sắc với ảnh 1.
    3. `edge-tts` đọc tiếng Việt mượt mà, thời lượng tổng rơi đúng 30s ± 1s.
    4. Remotion render xuất ra file `.mp4` chuẩn 1080x1920 sắc nét, chữ phụ đề đồng bộ word boundaries của giọng đọc. Ảnh tĩnh không có chuyển động miệng.
    5. Video được gắn vào composer của Agent. Contract test xác nhận tool lập lịch nhận MP4 và trả link Tab 1 Lịch (`/launches`); service tạo bài được mock, không đăng hoặc lên lịch mạng xã hội thật trong kiểm thử này.

---
