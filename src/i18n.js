    const EN_TEXT = Object.freeze({
      "Отменить": "Cancel",
      "Операция отменена. Секретные поля очищены.": "Operation cancelled. Secret fields cleared.",
      "Секретные поля очищены. Создайте контейнер заново.": "Secret fields were cleared. Create the container again.",
      "Проверяю контейнер": "Verifying container",
      "Контейнер создан": "Container created",
      "Создать": "Create",
      "Прочитать": "Read",
      "Справка": "Help",
      "Светлая тема": "Light theme",
      "Темная тема": "Dark theme",
      "Светлая": "Light",
      "Темная": "Dark",
      "Тема": "Theme",
      "Название": "Name",
      "Введите название...": "Enter a name...",
      "Настройки": "Settings",
      "Надежно · 8 цветов": "Strong · 8 colors",
      "Очистить все": "Clear all",
      "Контейнер": "Container",
      "Мастер-ключ": "Master key",
      "Показать ключ": "Show key",
      "Скрыть пароль": "Hide password",
      "Показать пароль": "Show password",
      "Слои": "Layers",
      "Добавить слой": "Add layer",
      "Закрыть": "Close",
      "Защита паролей": "Password protection",
      "Обычная": "Standard",
      "Усиленная": "Hardened",
      "Максимальная": "Maximum",
      "Максимальное": "Maximum",
      "Экстремальная": "Extreme",
      "Создать ключ": "Generate key",
      "Создать файл": "Generate file",
      "Сгенерировать мастер-ключ": "Generate master key",
      "Добавить ключ-файл": "Add key file",
      "Создать новый": "Create new",
      "Выбрать существующий": "Choose existing",
      "Подключить ключ-файл": "Attach key file",
      "Убрать ключ-файл": "Remove key file",
      "Ключ-файл подключен": "Key file attached",
      "Ключ-файл": "Key file",
      "Убрать файл": "Remove file",
      "Опционально: файл становится вторым фактором и не сохраняется в контейнере.": "Optional: the file becomes a second factor and is not stored in the container.",
      "Выберите тот же файл, если он использовался при создании.": "Select the same file if one was used when creating the container.",
      "Ключ-файл подключен. Без него мастер-ключ не сработает.": "Key file attached. The master key will not work without it.",
      "Ключ-файл не используется.": "No key file is in use.",
      "Сгенерирован стойкий мастер-ключ. Сохраните его отдельно.": "A strong master key was generated. Store it separately.",
      "Ключ-файл должен содержать не менее 16 байт.": "The key file must contain at least 16 bytes.",
      "Ключ-файл слишком большой. Максимум — 16 MiB.": "The key file is too large. The maximum is 16 MiB.",
      "Ключ-файл не выбран.": "No key file was selected.",
      "Мастер-ключ слишком короткий: используйте не менее 6 символов.": "The master key is too short: use at least 6 characters.",
      "Пароль слоя слишком короткий: используйте не менее 6 символов.": "The layer password is too short: use at least 6 characters.",
      "Мастер-ключ не должен совпадать с паролем слоя.": "The master key must not match a layer password.",
      "Секретные поля и расшифрованный результат очищены после 15 минут бездействия.": "Secret fields and the decrypted result were cleared after 15 minutes of inactivity.",
      "Скопировано. Помните: системный буфер обмена находится вне контроля LayerLock.": "Copied. Remember: the system clipboard is outside LayerLock's control.",
      "Восстановление повреждений": "Damage recovery",
      "Стандартное": "Standard",
      "Запас восстановления": "Recovery level",
      "Минимум": "Minimum",
      "Стандарт": "Standard",
      "Повышенный": "Enhanced",
      "Максимум": "Maximum",
      "Добавляет умеренный запас данных для восстановления частично поврежденного изображения.": "Adds a moderate amount of redundancy for recovering a partially damaged image.",
      "Минимальное": "Minimal",
      "Повышенное": "Enhanced",
      "Пользовательское": "Custom",
      "ошибка": "error",
      "Как работает": "How it works",
      "Раздел справки": "Help section",
      "Что заполнять": "What to enter",
      "Введите название. Оно используется для имен файлов и ZIP-папки.": "Enter a name. It is used for file names and the ZIP folder.",
      "В блоке “Контейнер” задайте мастер-ключ. Он открывает контейнер и скрывает структуру слоев.": "Set a master key in the “Container” section. It unlocks the container and conceals the layer structure.",
      "При необходимости подключите ключ-файл. Он не попадает в контейнер: для чтения понадобится этот же файл, а его потеря необратима.": "Optionally attach a key file. It is not stored in the container: the same file is required for reading, and losing it is irreversible.",
      "Добавьте слой: пароль слоя и текст, который нужно получить при этом пароле.": "Add a layer with its password and the text that should be revealed by that password.",
      "Как создается изображение": "How the image is created",
      "Текст слоя нормализуется, сжимается и шифруется AES-GCM своим изолированным ключом. Пароли укрепляются Argon2id; настройка “Защита паролей” меняет память и число проходов. Контейнер отдельно закрывается мастер-ключом. “Восстановление повреждений” управляет встроенной коррекцией Aztec для камеры и печати.": "Each layer's text is normalized, compressed, and encrypted with AES-GCM using an isolated key. Passwords are hardened with Argon2id; “Password protection” controls memory usage and the number of passes. The container is separately locked with the master key. “Damage recovery” controls Aztec's built-in error correction for cameras and printing.",
      "Мастер-ключ и каждый пароль слоя должны содержать не менее 6 символов. Оценка сложности служит подсказкой и не мешает созданию. Короткие и предсказуемые пароли легче подобрать: для важных данных используйте длинные случайные пароли. Пароли разных слоев и мастер-ключ должны различаться. Секретные поля и открытый результат очищаются после 15 минут бездействия.": "The master key and each layer password must contain at least 6 characters. The strength rating is advisory and does not block creation. Short and predictable passwords are easier to guess: use long random passwords for important data. Layer passwords and the master key must differ. Secret fields and decrypted results are cleared after 15 minutes of inactivity.",
      "Скачивание": "Downloads",
      "PNG и SVG скачивают Aztec-контейнер. Компактные TXT и RAW сохраняют зашифрованное ядро до оптической коррекции и позволяют заново построить Aztec и SVG. ZIP повторно проверяет контейнер и сохраняет PNG, SVG, TXT, RAW и “settings.txt”. Ключи и пароли туда не записываются.": "PNG and SVG download the Aztec container. Compact TXT and RAW store the encrypted core before optical error correction and can rebuild Aztec and SVG. ZIP verifies the container and saves PNG, SVG, TXT, RAW, and settings.txt. Keys and passwords are never written to it.",
      "Пример: название “Документы” -> Документы-xxxxxx.png / Документы-xxxxxx.zip": "Example: name “Documents” -> Documents-xxxxxx.png / Documents-xxxxxx.zip",
      "Документы-xxxxxx.png / Документы-xxxxxx.zip": "Documents-xxxxxx.png / Documents-xxxxxx.zip",
      "Как загрузить": "How to load an image",
      "Выберите “Файл”, “Камера”, перетащите картинку в зону загрузки или вставьте ее через Ctrl+V. Сканер ищет Aztec, проверяет оптическую оболочку и коррекцию ошибок, после чего предлагает мастер-ключ. Камера подсказывает проблемы со светом и резкостью. Видео остается только в памяти устройства.": "Choose “File” or “Camera”, drag an image into the upload area, or paste it with Ctrl+V. The scanner locates the Aztec symbol, validates the optical envelope and error correction, then asks for the master key. The camera provides lighting and sharpness guidance. Video remains only in device memory.",
      "Два этапа доступа": "Two-stage access",
      "Введите мастер-ключ, чтобы открыть контейнер. До этого слои и их количество не раскрываются.": "Enter the master key to unlock the container. Until then, the layers and their count remain concealed.",
      "Если контейнер создавался с ключ-файлом, выберите тот же файл до открытия. Сам контейнер не сообщает, использовался ли второй фактор.": "If the container was created with a key file, select the same file before unlocking it. The container itself does not reveal whether a second factor was used.",
      "После успешного открытия появится поле “Пароль слоя”. Введите пароль нужного слоя, и текст появится в результате.": "After the container is unlocked, the “Layer password” field appears. Enter the password for the required layer to reveal its text.",
      "Если не открывается": "If it does not open",
      "Проверьте мастер-ключ, пароль слоя, обрезку изображения и сжатие с потерями. Для бумажной копии лучше сохранить четкий контраст и не закрывать углы изображения.": "Check the master key, layer password, image cropping, and lossy compression. For printed copies, preserve strong contrast and keep the image corners unobstructed.",
      "Изображение": "Image",
      "Открыть на весь экран": "Open full screen",
      "Проверить": "Verify",
      "Изображение еще не создано.": "No image has been created yet.",
      "Скачать PNG": "Download PNG",
      "Скачать SVG": "Download SVG",
      "Скачать компактный TXT": "Download compact TXT",
      "Скачать компактный RAW": "Download compact RAW",
      "Скачать ZIP": "Download ZIP",
      "Печать": "Print",
      "Источник изображения": "Image source",
      "Файл": "File",
      "Камера": "Camera",
      "Код": "Code",
      "Компактный контейнер": "Compact container",
      "Вставьте содержимое TXT, чтобы открыть контейнер.": "Paste the TXT contents to open the container.",
      "Загрузить другой контейнер": "Load another container",
      "Восстановить контейнер": "Restore container",
      "Скачать восстановленный SVG": "Download restored SVG",
      "Загрузить PNG": "Upload PNG",
      "Отправьте изображение": "Upload an image",
      "Или нажмите, выберите файл, либо вставьте через Ctrl+V.": "Click to choose a file, drag it here, or paste with Ctrl+V.",
      "Результат": "Result",
      "Ввод пароля": "Password entry",
      "Скопировать": "Copy",
      "Показать мастер-ключ": "Show master key",
      "Пароль слоя": "Layer password",
      "Показать пароль слоя": "Show layer password",
      "Введите мастер-ключ.": "Enter the master key.",
      "Открыть контейнер": "Unlock container",
      "Ищу контейнер": "Locating container",
      "Увеличить": "Enlarge",
      "Заменить": "Replace",
      "Создание": "Creating",
      "Подготовка...": "Preparing...",
      "Сканирование камерой": "Camera scanning",
      "Запускаю камеру...": "Starting camera...",
      "Закрыть камеру": "Close camera",
      "Сделать системный снимок": "Take a system photo",
      "Системная камера": "System camera",
      "Сканировать текущий кадр": "Scan current frame",
      "Сканировать": "Scan",
      "Накопленные кадры": "Captured frames",
      "Проверяю...": "Verifying...",
      "Проверено": "Verified",
      "Ошибка проверки": "Verification failed",
      "Пароль не введен": "Password not entered",
      "Пароли не совпадают": "Passwords do not match",
      "Этот пароль уже используется в другом слое": "This password is already used by another layer",
      "Введите название.": "Enter a name.",
      "Добавьте хотя бы один слой с паролем и текстом.": "Add at least one layer with a password and text.",
      "Создаю...": "Creating...",
      "Проверьте поля": "Check the fields",
      "Удалить": "Delete",
      "Пароль": "Password",
      "Повторите пароль": "Repeat password",
      "Текст": "Text",
      "Скопировать текст": "Copy text",
      "Argon2id недоступен в этом браузере.": "Argon2id is unavailable in this browser.",
      "Слой меньше текста после упаковки.": "The layer is smaller than the packed text.",
      "Кодек Aztec недоступен.": "The Aztec codec is unavailable.",
      "Не удалось создать Aztec.": "Could not create the Aztec symbol.",
      "Слишком много слоев.": "Too many layers.",
      "Слой слишком большой.": "The layer is too large.",
      "Не удалось собрать PNG.": "Could not create the PNG.",
      "Упаковываю слои": "Packaging layers",
      "Укрепляю мастер-ключ и закрываю контейнер": "Hardening the master key and locking the container",
      "Строю Aztec": "Building Aztec",
      "Рисую изображение": "Rendering image",
      "Сначала создайте изображение.": "Create an image first.",
      "Нет заполненных слоев для проверки.": "There are no completed layers to verify.",
      "Проверка не прошла: один из слоев не открылся.": "Verification failed: one of the layers could not be opened.",
      "Aztec-контейнер не распознан. Проверьте обрезку, резкость и отсутствие сжатия с потерями.": "The Aztec container was not recognized. Check cropping, sharpness, and lossy compression.",
      "Сначала загрузите изображение.": "Load an image first.",
      "Расшифровать": "Decrypt",
      "Мастер-ключ не подошел.": "The master key is incorrect.",
      "Контейнер открыт. Введите пароль слоя.": "Container unlocked. Enter a layer password.",
      "Введите пароль слоя.": "Enter a layer password.",
      "Слой открыт.": "Layer unlocked.",
      "Контейнер найден, но этот пароль не открыл ни один слой.": "The container was found, but this password did not unlock any layer.",
      "Нужен файл изображения.": "An image file is required.",
      "Вставьте компактный код.": "Paste a compact code.",
      "Формат компактного кода не распознан.": "The compact code format was not recognized.",
      "Версия компактного кода не поддерживается.": "This compact code version is not supported.",
      "Компактный код содержит недопустимые символы.": "The compact code contains invalid characters.",
      "Компактный контейнер не готов.": "The compact container is not ready.",
      "Структура компактного кода повреждена.": "The compact code structure is damaged.",
      "Контрольная сумма компактного кода не совпала.": "The compact code checksum did not match.",
      "Компактный контейнер восстановлен.": "Compact container restored.",
      "Восстанавливаю компактный контейнер...": "Restoring compact container...",
      "Файл SVG не распознан.": "The SVG file could not be recognized.",
      "SVG содержит неподдерживаемое активное содержимое.": "The SVG contains unsupported active content.",
      "SVG не содержит корректного размера.": "The SVG does not contain valid dimensions.",
      "SVG слишком большой для безопасной обработки.": "The SVG is too large to process safely.",
      "Не удалось открыть SVG.": "Could not open the SVG file.",
      "Изображение загружено. Ищу контейнер...": "Image loaded. Locating container...",
      "Слишком темно · добавьте света": "Too dark · add more light",
      "Слишком ярко · уберите блик": "Too bright · reduce glare",
      "Недостаточно контраста · поднесите камеру ближе": "Insufficient contrast · move the camera closer",
      "Кадр размыт · зафиксируйте телефон": "Frame is blurred · hold the phone steady",
      "Качество кадра подходит": "Frame quality is good",
      "Не удалось сохранить кадр камеры.": "Could not save the camera frame.",
      "Контейнер найден": "Container found",
      "Не удалось сохранить кадр. Попробуйте ещё раз": "Could not save the frame. Try again",
      "Ищу Aztec": "Locating Aztec",
      "Держите Aztec целиком внутри рамки": "Keep the entire Aztec symbol inside the frame",
      "Запрашиваю доступ к камере...": "Requesting camera access...",
      "Live-камера недоступна. Открываю системную камеру.": "Live camera is unavailable. Opening the system camera.",
      "Наведите рамку на контейнер": "Align the container inside the frame",
      "Камера недоступна. Открываю системный снимок.": "Camera is unavailable. Opening the system photo picker.",
      "Сканировать камерой": "Scan with camera",
      "Сканируйте камерой": "Scan with the camera",
      "Наведите камеру на изображение или нажмите сюда, чтобы открыть камеру.": "Point the camera at the image, or tap here to open the camera.",
      "Браузер не дал доступ к изображению в буфере.": "The browser did not allow access to the clipboard image.",
      "В буфере нет изображения.": "The clipboard does not contain an image.",
      "Создание...": "Creating...",
      "Проверяю качество Aztec": "Verifying Aztec quality",
      "Готово · проверка пройдена": "Done · verification passed",
      "Создано · проверка требует внимания": "Created · verification requires attention",
      "Проверено: слои открываются, масштабирование и потеря контраста пройдены.": "Verified: layers unlock successfully and the scaling and contrast-loss checks passed.",
      "Текст скопирован.": "Text copied.",
      "Не удалось скопировать текст.": "Could not copy the text.",
      "Результат скопирован.": "Result copied.",
      "Не удалось скопировать результат.": "Could not copy the result.",
      "Проверяю контейнер перед ZIP...": "Verifying the container before creating the ZIP...",
      "Проверяю пароль слоя через Argon2id...": "Verifying the layer password with Argon2id...",
      "Проверяю мастер-ключ через Argon2id...": "Verifying the master key with Argon2id...",
      "Ищу контейнер и проверяю мастер-ключ...": "Locating the container and verifying the master key...",
      "Минимальный дополнительный объем для чистых цифровых копий.": "Minimal redundancy for clean digital copies.",
      "Умеренный запас данных для восстановления частично поврежденного изображения.": "Moderate redundancy for recovering a partially damaged image.",
      "Повышенный запас для фотографий, масштабирования и небольших дефектов.": "Enhanced redundancy for photos, scaling, and minor defects.",
      "Максимальный запас восстановления; изображение будет крупнее.": "Maximum recovery redundancy; the image will be larger.",
      "Очистить все слои, название и сгенерированное изображение?": "Clear all layers, the name, and the generated image?",
      "Текущее изображение, введенные ключи и результат будут сброшены. Загрузить другое изображение?": "The current image, entered keys, and result will be cleared. Load another image?",
      "Легкий": "Weak",
      "Средний": "Moderate",
      "Надежный": "Strong",
      "Сложный": "Very strong",
      "Ключ-файл скачан. Выберите его повторно, чтобы подтвердить сохранение.": "The key file was downloaded. Select it again to confirm that it was saved.",
      "Подтвердить ключ-файл": "Confirm key file",
      "Выбран не тот ключ-файл. Подтвердите только что скачанный файл или отмените операцию.": "This is not the downloaded key file. Select the file that was just downloaded or cancel the operation.",
      "Ключ-файл скачан. Повторно выберите его для подтверждения.": "The key file was downloaded. Select it again to confirm it.",
      "Подтвердите скачанный ключ-файл перед созданием контейнера.": "Confirm the downloaded key file before creating the container.",
      "Компактный код превышает безопасный лимит.": "The compact code exceeds the safe limit.",
      "Компактный контейнер превышает безопасный лимит.": "The compact container exceeds the safe limit.",
      "Контейнер превышает безопасный лимит.": "The container exceeds the safe limit.",
      "Контейнер превышает безопасный лимит. Сократите текст или число слоев.": "The container exceeds the safe limit. Shorten the text or reduce the number of layers.",
      "Файл изображения превышает безопасный лимит.": "The image file exceeds the safe limit.",
      "Изображение не содержит корректного размера.": "The image does not contain valid dimensions.",
      "Изображение слишком большое для безопасной обработки.": "The image is too large to process safely.",
      "Распакованный текст превышает безопасный лимит.": "The decompressed text exceeds the safe limit.",
      "Встроенный модуль распаковки недоступен.": "The embedded decompression module is unavailable.",
      "Сжатые данные повреждены или не завершены.": "The compressed data is damaged or incomplete.",
      "Сжатые данные превышают безопасный лимит.": "The compressed data exceeds the safe limit.",
      "Текст слоя превышает безопасный лимит 1 MiB.": "The layer text exceeds the 1 MiB safe limit.",
      "Длина распакованного текста не совпала.": "The decompressed text length did not match.",
      "Текст слоя содержит поврежденные UTF-8 данные.": "The layer text contains invalid UTF-8 data.",
      "Изображение появится здесь": "The image will appear here",
      "Здесь появится расшифрованный текст.": "Decrypted text will appear here."
    });

    const EN_TEXT_CASEFOLD = new Map(Object.entries(EN_TEXT).map(([source, translation]) => [source.toLocaleLowerCase("ru"), translation]));

    const EN_PATTERNS = Object.freeze([
      [/^Слой (\d+)$/, (_, n) => `Layer ${n}`],
      [/^Слой (\d+): введите пароль\.$/, (_, n) => `Layer ${n}: enter a password.`],
      [/^Слой (\d+): пароли не совпадают\.$/, (_, n) => `Layer ${n}: passwords do not match.`],
      [/^Слой (\d+): введите текст\.$/, (_, n) => `Layer ${n}: enter text.`],
      [/^Слой (\d+): Пароль слоя слишком короткий: используйте не менее 6 символов\.$/, (_, n) => `Layer ${n}: the layer password is too short; use at least 6 characters.`],
      [/^Слои (.+): одинаковые пароли запрещены\.$/, (_, list) => `Layers ${list.replace(/ и /g, " and ")}: duplicate passwords are not allowed.`],
      [/^Argon2id \+ HKDF-SHA-256 · (.+) MiB · (\d+) прохода$/, (_, memory, passes) => `Argon2id + HKDF-SHA-256 · ${memory} MiB · ${passes} passes`],
      [/^Проверено · (.+)$/, (_, detail) => `Verified · ${detail}`],
      [/^Не прошло · (.+)$/, (_, detail) => `Failed · ${detail}`],
      [/^Подготовка данных · профиль (.+)$/, (_, profile) => `Preparing data · ${translateForLanguage(profile, "en")} profile`],
      [/^Укрепляю и шифрую слой (\d+)\/(\d+)(.*)$/, (_, n, total, eta) => `Hardening and encrypting layer ${n}/${total}${translateForLanguage(eta, "en")}`],
      [/^· примерно (\d+) сек$/, (_, seconds) => `· about ${seconds} sec`],
      [/^Добавляю коррекцию ошибок · (.+)$/, (_, level) => `Adding error correction · ${translateForLanguage(level, "en").toLowerCase()}`],
      [/^Настраиваю коррекцию Aztec · (.+)$/, (_, level) => `Configuring Aztec error correction · ${translateForLanguage(level, "en").toLowerCase()}`],
      [/^Проверяю (.+)$/, (_, format) => `Verifying ${format}`],
      [/^(.+) создан$/, (_, format) => `${format} created`],
      [/^Детали:$/, () => "Details:"],
      [/^(\d+) байт, (\d+) слой\(я\), (.+), матрица (\d+) x (\d+), изображение (\d+) x (\d+)\.$/, (_, bytes, layers, format, mw, mh, iw, ih) => `${bytes} bytes, ${layers} layer(s), ${format}, ${mw} x ${mh} matrix, ${iw} x ${ih} image.`],
      [/^(.+) прошел (\d+) из (\d+) сценариев качества\.$/, (_, format, passed, total) => `${format} passed ${passed} of ${total} quality scenarios.`],
      [/^(\d+) мс$/, (_, ms) => `${ms} ms`],
      [/^(\d+\.\d) с$/, (_, seconds) => `${seconds} s`],
      [/^Контейнер найден за (.+)\. Введите мастер-ключ\.$/, (_, time) => `Container found in ${translateForLanguage(time, "en")}. Enter the master key.`],
      [/^ZIP собран\. (.+) проверен\.$/, (_, format) => `ZIP created. ${format} verified.`],
      [/^(.+) защита · (.+) восстановление · Aztec$/, (_, protection, recovery) => `${translateForLanguage(protection, "en")} protection · ${translateForLanguage(recovery, "en")} recovery · Aztec`],
      [/^Настройки: (.+) защита паролей, (.+) восстановление, Aztec$/, (_, protection, recovery) => `Settings: ${translateForLanguage(protection, "en")} password protection, ${translateForLanguage(recovery, "en")} recovery, Aztec`]
    ]);

    let currentLanguage = "ru";
    let applyingLanguage = false;
    const localizedTextSources = new WeakMap();
    const localizedAttributeSources = new WeakMap();
    const LOCALIZED_ATTRIBUTES = ["aria-label", "title", "placeholder", "aria-valuetext"];

    function translateForLanguage(value, language = currentLanguage) {
      if (language !== "en" || typeof value !== "string") return value;
      const leading = value.match(/^\s*/)?.[0] || "";
      const trailing = value.match(/\s*$/)?.[0] || "";
      const source = value.trim();
      if (!source) return value;
      let translated = EN_TEXT[source];
      if (!translated) {
        const folded = EN_TEXT_CASEFOLD.get(source.toLocaleLowerCase("ru"));
        if (folded) translated = source[0] === source[0]?.toLocaleLowerCase("ru")
          ? folded[0].toLocaleLowerCase("en") + folded.slice(1)
          : folded;
      }
      if (!translated) {
        for (const [pattern, replacement] of EN_PATTERNS) {
          if (pattern.test(source)) {
            translated = source.replace(pattern, replacement);
            break;
          }
        }
      }
      return translated ? leading + translated + trailing : value;
    }

    function localizeTextNode(node) {
      if (!node?.parentElement || node.parentElement.closest("script, style, textarea, #languageToggle, #readout, #printTitle")) return;
      const value = node.nodeValue || "";
      let source = localizedTextSources.get(node);
      if (!source || /[А-Яа-яЁё]/.test(value)) {
        source = value;
        localizedTextSources.set(node, source);
      }
      const next = currentLanguage === "en" ? translateForLanguage(source, "en") : source;
      if (node.nodeValue !== next) node.nodeValue = next;
    }

    function localizeElement(element) {
      if (!(element instanceof Element) || element.closest("script, style, textarea, #languageToggle, #readout, #printTitle")) return;
      let sources = localizedAttributeSources.get(element);
      if (!sources) {
        sources = {};
        localizedAttributeSources.set(element, sources);
      }
      for (const attribute of LOCALIZED_ATTRIBUTES) {
        if (!element.hasAttribute(attribute)) continue;
        const value = element.getAttribute(attribute) || "";
        if (!(attribute in sources) || /[А-Яа-яЁё]/.test(value)) sources[attribute] = value;
        const next = currentLanguage === "en" ? translateForLanguage(sources[attribute], "en") : sources[attribute];
        if (element.getAttribute(attribute) !== next) element.setAttribute(attribute, next);
      }
    }

    function localizeTree(root = document) {
      applyingLanguage = true;
      try {
        if (root.nodeType === Node.TEXT_NODE) localizeTextNode(root);
        if (root.nodeType === Node.ELEMENT_NODE) localizeElement(root);
        const scope = root.nodeType === Node.DOCUMENT_NODE ? root.documentElement : root;
        scope?.querySelectorAll?.("*").forEach(localizeElement);
        const walker = document.createTreeWalker(scope || document.documentElement, NodeFilter.SHOW_TEXT);
        let node;
        while ((node = walker.nextNode())) localizeTextNode(node);
      } finally {
        applyingLanguage = false;
      }
    }

    const languageObserver = new MutationObserver(records => {
      if (applyingLanguage) return;
      for (const record of records) {
        if (record.type === "characterData") localizeTextNode(record.target);
        else if (record.type === "attributes") localizeElement(record.target);
        else record.addedNodes.forEach(localizeTree);
      }
    });

    function localizedConfirm(message) {
      return confirm(translateForLanguage(message));
    }

    function applyLanguage(language, persist = true) {
      currentLanguage = language === "en" ? "en" : "ru";
      document.documentElement.lang = currentLanguage;
      document.body.classList.toggle("lang-en", currentLanguage === "en");
      localizeTree(document);
      const toggle = document.getElementById("languageToggle");
      if (toggle) {
        toggle.dataset.language = currentLanguage;
        toggle.title = currentLanguage === "en" ? "Переключить на русский" : "Switch to English";
        toggle.setAttribute("aria-label", toggle.title);
      }
      document.querySelectorAll(".field-select").forEach(wrapper => wrapper._syncLanguage?.());
      if (persist) {
        try { localStorage.setItem("layerlock-language", currentLanguage); } catch (_) {}
      }
    }
