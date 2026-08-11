# Feature: Real-Time Peer-to-Peer Image Sharing & Persistence

## Overview
This pull request introduces high-performance, real-time image sharing directly between users inside ClipYard rooms using WebRTC DataChannels. The transfer is completely peer-to-peer—meaning images are never stored on a centralized server, preserving the ephemeral and private nature of ClipYard. Furthermore, it implements local IndexedDB storage so received images persist securely on the user's device across page reloads.

## Key Features & Implementations

### 1. Peer-to-Peer File Transfer Engine
*   **WebRTC Data Channels:** Images are chunked and streamed directly between browsers over WebRTC.
*   **Large File Support:** Hand-rolled chunking mechanism supporting up to 10MB images with 16KB data channel chunks.
*   **Backpressure Handling:** Smart buffer monitoring to pause sending when the WebRTC buffer gets full, preventing memory crashes.
*   **Broadcasting:** Automatically blasts images to every peer in the room simultaneously.

### 2. Local Persistence (IndexedDB)
*   **Cross-Reload Persistence:** Received images are securely saved as large binary Blobs directly to the browser's `IndexedDB` under the current Room ID.
*   **Instant Recovery:** If a user accidentally refreshes or hard-reloads the page, their received images are instantly re-loaded from the database without needing to be re-sent by the host.
*   **Strict Mode Resiliency:** Includes deduplication logic to prevent duplicate image rendering during rapid component remounting (e.g., React 18 Strict Mode).

### 3. Premium Image Sharing UI
*   **Drag & Drop Uploader:** A highly polished `ImageUploader` with micro-interactions, scale/translate animations, and drag-state visual feedback.
*   **Aggregated Progress Bars:** Broadcasting to 10 peers creates just **one** unified, aggregated progress bar instead of cluttering the UI.
*   **Full Screen Lightbox Modal:** Clicking a received image securely opens it in a beautiful, blurred-background fullscreen modal directly inside the app, removing the need for clunky browser tabs.

### 4. Stability & Edge Case Handling
*   **WebRTC Reconnect Deadlock Fix:** Built an `instanceId` tracker injected into Firebase presence. If a user refreshes their tab (keeping the same UID but losing their RTC state), peers instantly detect the `instanceId` change, forcibly teardown the broken connection, and gracefully reconnect.

### 5. Code Maintenance
*   **Next.js 15 Fixes:** Resolved strict typing errors in Next.js 15 API route handlers where `params` must now be unwrapped as a Promise.

## Testing Instructions
1. Open a ClipYard room in two different browsers or windows.
2. Ensure both peers connect successfully (look for `P2P Connected (1)` status badge).
3. Drag and drop an image into the dropzone.
4. Hit **Send** and watch the real-time progress bar.
5. Click the received image on the secondary browser to test the full-screen Lightbox Modal.
6. Refresh the receiving browser tab. Verify that the image magically persists on the screen thanks to IndexedDB!
