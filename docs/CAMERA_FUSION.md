# LayerLock Camera Fusion

Status: private development implementation for LayerLock v6.

## Purpose

The live camera mode continuously searches for a LayerLock container without
uploading video or requesting network resources. A normal system camera input
remains available when live capture is unsupported or permission is denied.

## Processing Pipeline

1. Request the rear-facing camera with ideal 1920 x 1080 constraints.
2. Reduce each working frame to at most 720 pixels on its longest side.
3. Measure exposure, contrast and edge sharpness, with direct center decoding attempted first.
4. Estimate the four anchors and projectively rectify a candidate to 512 x 512 pixels.
5. Retain at most three geometrically aligned candidates.
6. Fuse RGB channels with a per-pixel median and retry exact decoding.
7. Run the general Scanner 2 density locator on alternating frames in a Worker.
8. Stop every media track immediately after success, cancellation, tab hiding,
   navigation away from the read view, or page shutdown.

## Privacy Boundary

- Camera frames remain in browser memory.
- Frames are not written to storage or transmitted over the network.
- The Scanner 2 worker receives pixels only; it never receives passwords, keys,
  plaintext, encrypted slots, or the decrypted container manifest.
- Only the successfully selected candidate is retained as the read preview.

## Fallbacks

- Missing `getUserMedia`: open the existing `capture="environment"` input.
- Insecure context: use the system camera input.
- Permission denial or unavailable camera: show a notification and offer the
  system camera input.
- Worker failure: Scanner 2 uses its local detector fallback.

## Release Tests

- iPhone Safari and installed PWA, portrait and landscape.
- Android Chromium with rear and front camera-only devices.
- Permission accepted, denied, dismissed, and revoked during capture.
- Close the modal while the permission prompt is pending.
- Background the page while scanning and confirm the camera indicator stops.
- Bright glare moving between three frames; fusion should reject the outlier.
- Mild hand movement and focus hunting.
- Container at multiple distances, rotations, and positions in a larger scene.
- Confirm no camera frame is present in IndexedDB, localStorage, Cache Storage,
  downloads, or network requests.
