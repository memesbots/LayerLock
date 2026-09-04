    function varUintSize(value) {
      let size = 1;
      while (value >= 128) { value = Math.floor(value / 128); size++; }
      return size;
    }

    async function measureCapacity(notes) {
      const op = operationTicket();
      let rawBytes = 0;
      let compressedBytes = 0;
      let packBytes = 4 + varUintSize(notes.length);
      for (const text of notes) {
        const note = await encodeNoteText(text);
        try {
          op.check();
          rawBytes += note.rawLength;
          compressedBytes += note.bytes.length;
          const slotBytes = 1 + varUintSize(note.rawLength) + note.bytes.length + 16;
          packBytes += 8 + varUintSize(slotBytes) + slotBytes;
        } finally { note.bytes.fill(0); }
      }
      const encryptedBytes = packBytes + 16;
      const containerBytes = 22 + varUintSize(encryptedBytes) + encryptedBytes;
      const rawFileBytes = 9 + varUintSize(containerBytes) + containerBytes;
      return {rawBytes,compressedBytes,containerBytes,rawFileBytes};
    }

    let capacityRevision = 0;
    let capacityTimer;
    function scheduleCapacity() {
      clearTimeout(capacityTimer);
      const revision = ++capacityRevision;
      const op = operationTicket();
      capacityTimer = setTimeout(async () => {
        const node = $('capacityStatus');
        const notes = [...document.querySelectorAll('#entries .entry-text')].map(input => input.value);
        if (!notes.some(Boolean)) { node.textContent = ''; return; }
        try {
          const result = await measureCapacity(notes);
          if (revision !== capacityRevision || !op.current()) return;
          const english = currentLanguage === 'en';
          node.textContent = english
            ? `Text ${result.rawBytes} B · Compressed ${result.compressedBytes} B · RAW ${result.rawFileBytes} B`
            : `Текст ${result.rawBytes} Б · Сжатие ${result.compressedBytes} Б · RAW ${result.rawFileBytes} Б`;
          node.classList.toggle('bad', result.containerBytes > MAX_CONTAINER_BYTES);
        } catch (error) {
          if (revision === capacityRevision && op.current()) node.textContent = translateForLanguage(error.message);
        }
      }, 600);
    }
