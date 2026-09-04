    const api = {
      SLOT_VERSION, PACK_VERSION, ENVELOPE_VERSION, KDF_ID, KDF_NAME, HKDF_HASH,
      KEY_CONTEXT, KDF_PROFILES, FEC_PROFILES, MAX_CONTAINER_BYTES,
      randomBytes, bytesToHex, crc32, deriveKey, deriveDomainBytes, argon2idRaw,
      argon2WorkerSource, validateKdfParams, kdfProfileIndex, kdfProfileFromIndex,
      passwordPolicyIssue, passwordIdentity, passwordScore,
      encryptSlot, decryptSlot, encodePack, decodePack, encodeEnvelope,
      decodeEnvelope, decodeBody, encryptContainer, decryptContainer, makeSvg,
      makeCompactBytes, parseCompactBytes, makeCompactText, parseCompactText,
      encodeNoteText, decodeNoteText, decompress, writeVarUint,
      validateImageDimensions, readRasterDimensions, createAztecRender,
      renderSigil, decodePackageFromCanvas,
      operationTicket, cancelOperations, state, clearSensitiveData, readVault,
      resetReadImageFlow, makeVault, loadCompactContainerText, measureCapacity,
      scanRegions, verifyContainerBody, translateForLanguage,
      scannerWorkerSource, attachKeyFile, generateKeyFile, clearKeyFile,
      createCameraHintGate
    };
