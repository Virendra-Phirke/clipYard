# Feature: Real-Time Peer-to-Peer Image Sharing

## Overview
This pull request introduces high-performance, real-time image sharing directly between users inside ClipYard rooms using WebRTC DataChannels. The transfer is completely peer-to-peer—meaning images are never stored on a centralized server, preserving the ephemeral and private nature of ClipYard.

## Key Features & Implementations

### 1. Peer-to-Peer File Transfer Engine
*   **WebRTC Data Channels:** Images are chunked and streamed directly between browsers over WebRTC.
*   **Large File Support:** Hand-rolled chunking mechanism supporting up to 10MB images with 16KB data channel chunks.
*   **Backpressure Handling:** Smart buffer monitoring to pause sending when the WebRTC buffer gets full, preventing memory crashes.
*   **Broadcasting:** Automatically blasts images to every peer in the room simultaneously.

### 2. Premium Image Sharing UI
*   **Drag & Drop Uploader:** A highly polished `ImageUploader` with micro-interactions, scale/translate animations, and drag-state visual feedback.
*   **Aggregated Progress Bars:** Broadcasting to 10 peers creates just **one** unified, aggregated progress bar instead of cluttering the UI.
*   **Full Screen Lightbox Modal:** Clicking a received image securely opens it in a beautiful, blurred-background fullscreen modal directly inside the app, removing the need for clunky browser tabs.

### 3. Stability & Edge Case Handling
*   **WebRTC Reconnect Deadlock Fix:** Built an `instanceId` tracker injected into Firebase presence. If a user refreshes their tab (keeping the same UID but losing their RTC state), peers instantly detect the `instanceId` change, forcibly teardown the broken connection, and gracefully reconnect.
*   **Session-based Memory:** Received image Blobs securely persist in local memory as `ObjectURL`s for the duration of the room session and are cleanly revoked upon leaving the room.

### 4. Code Maintenance
*   **Next.js 15 Fixes:** Resolved strict typing errors in Next.js 15 API route handlers where `params` must now be unwrapped as a Promise.

## Testing Instructions
1. Open a ClipYard room in two different browsers or windows.
2. Ensure both peers connect successfully (look for `P2P Connected (1)` status badge).
3. Drag and drop an image into the dropzone.
4. Hit **Send** and watch the real-time progress bar.
5. Click the received image on the secondary browser to test the full-screen Lightbox Modal.
6. Refresh one tab and ensure the WebRTC connection auto-recovers gracefully without deadlocking.
