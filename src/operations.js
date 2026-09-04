    let operationEpoch = 0;

    function operationTicket() {
      const epoch = operationEpoch;
      return {
        current: () => epoch === operationEpoch,
        check() {
          if (epoch !== operationEpoch) throw new DOMException('Operation cancelled', 'AbortError');
        },
        async wait(promise) {
          const result = await promise;
          if (epoch !== operationEpoch) {
            if (ArrayBuffer.isView(result)) result.fill(0);
            if (result instanceof ArrayBuffer) new Uint8Array(result).fill(0);
            if (result?.bytes instanceof Uint8Array) result.bytes.fill(0);
            if (typeof result?.close === 'function') result.close();
            throw new DOMException('Operation cancelled', 'AbortError');
          }
          return result;
        }
      };
    }

    function cancelOperations() {
      operationEpoch++;
      const error = new DOMException('Operation cancelled', 'AbortError');
      state.argon2Worker?.terminate();
      state.argon2Worker = null;
      rejectArgon2Pending(error);
      stopScannerWorker(error);
      state.readDecodePromise = null;
    }

    function rethrowCancellation(error) {
      if (error?.name === 'AbortError') throw error;
    }
