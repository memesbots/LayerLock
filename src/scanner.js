    let scannerWorker = null;
    let scannerSequence = 0;
    const scannerPending = new Map();

    function scannerWorkerSource() {
      const vendor = $('opticalVendorSource')?.textContent;
      if (!vendor) throw new Error('Optical codec unavailable');
      return `${vendor}\n
const wasmBinary = Uint8Array.from(atob(globalThis.LAYERLOCK_ZXING_WASM_BASE64), c => c.charCodeAt(0));
globalThis.LAYERLOCK_ZXING_WASM_BASE64 = '';
const ready = ZXingWASM.prepareZXingModule({overrides:{wasmBinary}, fireImmediately:true});
let queue = Promise.resolve();
self.onmessage = event => {
  const {id, buffer, width, height, options} = event.data;
  queue = queue.then(async () => {
    try {
      await ready;
      const results = await ZXingWASM.readBarcodes(new ImageData(new Uint8ClampedArray(buffer),width,height), options);
      self.postMessage({id, results:results.map(r => ({bytes:r.bytes,orientation:r.orientation,position:r.position}))});
    } catch(error) { self.postMessage({id,error:error.message || String(error)}); }
  });
};`;
    }

    function stopScannerWorker(error = new DOMException('Operation cancelled', 'AbortError')) {
      scannerWorker?.terminate();
      scannerWorker = null;
      for (const item of scannerPending.values()) {
        clearTimeout(item.timer);
        item.reject(error);
      }
      scannerPending.clear();
    }

    async function scanPixels(image, options) {
      if (typeof Worker !== 'function') {
        await ensureZXing();
        return globalThis.ZXingWASM.readBarcodes(image, options);
      }
      if (!scannerWorker) {
        const url = URL.createObjectURL(new Blob([scannerWorkerSource()], {type:'text/javascript'}));
        try { scannerWorker = new Worker(url); }
        finally { URL.revokeObjectURL(url); }
        scannerWorker.onmessage = ({data}) => {
          const pending = scannerPending.get(data.id);
          if (!pending) return;
          scannerPending.delete(data.id);
          clearTimeout(pending.timer);
          if (data.error) pending.reject(new Error(data.error));
          else pending.resolve(data.results);
        };
        scannerWorker.onerror = event => stopScannerWorker(new Error(event.message || 'Scanner worker failed'));
      }
      return new Promise((resolve, reject) => {
        const id = ++scannerSequence;
        const timer = setTimeout(() => stopScannerWorker(new Error('Scanner timeout')), 6000);
        scannerPending.set(id, {resolve,reject,timer});
        scannerWorker.postMessage({id,buffer:image.data.buffer,width:image.width,height:image.height,options}, [image.data.buffer]);
      });
    }

    async function tryDecodeAztec(source, fast = false) {
      const op = operationTicket();
      try {
        const context = source.getContext("2d", { willReadFrequently: true });
        const image = context.getImageData(0, 0, source.width, source.height);
        const results = await op.wait(scanPixels(image, {
          formats: ["Aztec"],
          tryHarder: !fast,
          tryRotate: true,
          tryInvert: true,
          tryDownscale: true,
          tryDenoise: !fast,
          maxNumberOfSymbols: 4,
          returnErrors: false
        }));
        for (const result of results) {
          let body;
          try { body = decodeBody(new Uint8Array(result.bytes)); }
          catch (_) { continue; }
          return {
            body,
            transport: "aztec",
            formatLabel: "Aztec",
            orientation: result.orientation || 0,
            position: result.position || null
          };
        }
      } catch (error) { rethrowCancellation(error); }
      return null;
    }

    function scaledScanCanvas(source, maxSide) {
      const longest = Math.max(source.width, source.height);
      if (longest <= maxSide) return source;
      const scale = maxSide / longest;
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(source.width * scale));
      canvas.height = Math.max(1, Math.round(source.height * scale));
      const context = canvas.getContext("2d", { willReadFrequently: true });
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = "high";
      context.drawImage(source, 0, 0, canvas.width, canvas.height);
      return canvas;
    }

    async function decodePackageFromCanvas(canvas) {
      const op = operationTicket();
      const startedAt = typeof performance !== "undefined" ? performance.now() : Date.now();
      let candidates = 1;
      const fastCandidate = scaledScanCanvas(canvas, 1600);
      let decoded = await tryDecodeAztec(fastCandidate, true);
      if (!decoded) {
        op.check();
        candidates++;
        const thoroughCandidate = scaledScanCanvas(canvas, 2400);
        decoded = await tryDecodeAztec(thoroughCandidate, false);
      }
      // Native-resolution overlapping tiles preserve small dense symbols in large screenshots.
      if (!decoded && Math.max(canvas.width, canvas.height) > 1600) {
        for (const region of scanRegions(canvas.width, canvas.height)) {
          op.check();
          if (performance.now() - startedAt > 8000) break;
          const tile = cropCanvas(canvas, region.x, region.y, region.width, region.height);
          candidates++;
          decoded = await tryDecodeAztec(tile, false);
          if (decoded) break;
        }
      }
      op.check();
      if (!decoded) {
        throw new Error("Aztec-контейнер не распознан. Проверьте обрезку, резкость и отсутствие сжатия с потерями.");
      }
      return {
        ...decoded,
        scanPath: "aztec",
        scanCandidates: candidates,
        scanMs: (typeof performance !== "undefined" ? performance.now() : Date.now()) - startedAt
      };
    }

    function scanRegions(width, height) {
      const size = 1280;
      const positions = length => {
        if (length <= size) return [0];
        const count = Math.ceil((length - size) / 768);
        return Array.from({length:count + 1}, (_, i) => Math.round((length - size) * i / count));
      };
      const regions = positions(height).flatMap(y => positions(width).map(x => ({
        x,y,width:Math.min(size,width),height:Math.min(size,height)
      })));
      return regions.sort((a,b) =>
        Math.hypot(a.x+a.width/2-width/2,a.y+a.height/2-height/2) -
        Math.hypot(b.x+b.width/2-width/2,b.y+b.height/2-height/2)).slice(0,64);
    }
