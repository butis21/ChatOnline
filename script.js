let activeChatId = 'Чат 1'; // Переменная для отслеживания текущего активного чата
let chatCounter = 1; // Счетчик для генерации уникальных идентификаторов
const validPromoCodes = ["PROMO2024", "DISCOUNT50", "FREEACCESS"]; // Пример списка промокодов

document.getElementById('sendButton').addEventListener('click', () => sendMessage());

document.getElementById('applyPromoCodeButton').addEventListener('click', applyPromoCode);
// Проверка подписки при старте
let hasSubscription = JSON.parse(localStorage.getItem('hasSubscription')) || false;
updateChatStatus();

// Функция отправки сообщений
// Функция отправки сообщений
async function sendMessage(retryMessage = null) {
    const userInput = document.getElementById('userInput');
    const sendButton = document.getElementById('sendButton');
    let message = retryMessage || userInput.value.trim();

    if (message) {
        if (!retryMessage) {
            addMessageToChat(message, "user");
            userInput.value = '';
        }

        if (!retryMessage && checkSpecialQuestions(message)) {
            return;
        }

        userInput.disabled = true;
        sendButton.disabled = true;
        let loadingMessage = null;
        let lastBotMessageDiv = null;
        let previousMessage = message;

        if (retryMessage) {
            lastBotMessageDiv = document.querySelector('.chatbox .message.bot:last-child');
            lastBotMessageDiv.classList.add('loading');

            previousMessage = lastBotMessageDiv.querySelector('p').innerText;
            console.log("Продолжение на основе сообщения:", previousMessage);
        } else {
            // Добавляем сообщение "Загрузка ответа..." если это не продолжение
            loadingMessage = addMessageToChat("Загрузка ответа...", "bot", false);
            console.log("Начальный запрос на основе сообщения:", message);
        }

        try {
            let botMessage = "";
            let attempts = 0;

            // Делаем до 3 попыток получить корректный ответ
            while ((botMessage.trim() === "" || botMessage.length < 5) && attempts < 3) {
                const response = await fetch('https://api-inference.huggingface.co/models/mistralai/Mistral-Nemo-Instruct-2407', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': 'Bearer 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' // Замените на ваш API-токен
                    },
                    body: JSON.stringify({
                        inputs: previousMessage, // Используем только последнее сообщение для продления
                        parameters: {
                            max_length: 500, // Максимальная длина ответа
                            temperature: 0.3, // Управление креативностью ответов
                            top_p: 0.5 // Ограничение по выбору токенов
                        },
                        options: { wait_for_model: true }
                    })
                });

                const data = await response.json();
                botMessage = data[0].generated_text.trim();
                attempts++;

                // Если ответ пустой или слишком короткий, делаем еще одну попытку
                if (botMessage.trim() === "" || botMessage.length < 5) {
                    console.log(`Попытка ${attempts}: Получен некорректный ответ, повтор запроса.`);
                }
            }

            // Удаляем сообщение "Загрузка ответа..." если оно существует
            if (loadingMessage) {
                loadingMessage.remove();
            }

            // Убираем повторяющийся текст в начале ответа
            if (botMessage.startsWith(previousMessage)) {
                botMessage = botMessage.slice(previousMessage.length).trim();
            }

            // Если бот все равно вернул пустое сообщение, показываем ошибку
            if (botMessage.trim() === "") {
                addMessageToChat("Error: Бот не смог предоставить ответ. Задайте вопрос повторно перефразировав", "error");
                return;
            }

            if (retryMessage) {
                const lastBotMessageText = lastBotMessageDiv.querySelector('p');
                const combinedMessage = formatBotMessage(lastBotMessageText.innerHTML.trim() + botMessage.trim());
                lastBotMessageText.innerHTML = combinedMessage;

                // Сохраняем объединенный текст
                saveCombinedBotMessage(combinedMessage);

                // Убираем затемнение и анимацию после обновления текста
                lastBotMessageDiv.classList.remove('loading');
            } else {
                addMessageToChat(botMessage, "bot", true, true); // Кнопка "Продолжить" будет добавлена всегда
            }
        } catch (error) {
            // Удаляем сообщение "Загрузка ответа..." в случае ошибки
            if (loadingMessage) {
                loadingMessage.remove();
            }
            if (lastBotMessageDiv) {
                lastBotMessageDiv.classList.remove('loading');
            }
            addMessageToChat("Error: Не удалось получить ответ от сервера.", "error");
            console.error('Error:', error);
        } finally {
            // Разблокируем отправку новых сообщений
            userInput.disabled = false;
            sendButton.disabled = false;
            userInput.focus();
        }
    }
}


function applyPromoCode() {
    const promoCodeInput = document.getElementById('promoCodeInput').value.trim();
    const promoStatus = document.getElementById('promoStatus');

    if (validPromoCodes.includes(promoCodeInput)) {
        hasSubscription = true;
        localStorage.setItem('hasSubscription', true);
        promoStatus.textContent = "Подписка успешно активирована!";
        updateChatStatus();
    } else {
        promoStatus.textContent = "Неверный промокод. Попробуйте снова.";
    }
}

// Обновление статуса активного чата
function updateChatStatus() {
    const headerElement = document.querySelector('.headersub');
    if (hasSubscription) {
        headerElement.textContent = "(Активно)";
    } else {
        headerElement.textContent = "(Оформите подписку)";
    }
}

// Функция сохранения объединенного ответа в localStorage
function saveCombinedBotMessage(messageText) {
    const chats = JSON.parse(localStorage.getItem('chats')) || {};
    if (!chats[activeChatId]) {
        chats[activeChatId] = [];
    }
    // Обновляем последний ответ в чате
    const lastMessageIndex = chats[activeChatId].length - 1;
    if (lastMessageIndex >= 0) {
        chats[activeChatId][lastMessageIndex].text = messageText;
    } else {
        chats[activeChatId].push({ text: messageText, sender: "bot" });
    }
    localStorage.setItem('chats', JSON.stringify(chats));
}

// Функция обработки специальных вопросов
function checkSpecialQuestions(message) {
    const normalizedMessage = message.toLowerCase();

    if (normalizedMessage.includes("ты кто") || normalizedMessage.includes("кто ты")) {
        addMessageToChat("Привет! Я ChatGPT, и я работаю на этом сайте благодаря Роману Бутырину.", "bot");
        return true;
    }

    if (normalizedMessage.includes("что ты умеешь")) {
        addMessageToChat("Я умею помогать с различными вопросами, давать советы, объяснять концепции и многое другое! Всё это благодаря интеграции с Hugging Face и поддержке Романа Бутырина.", "bot");
        return true;
    }

    return false;
}

let codeBlocks = [];
// Функция форматирования ответа бота
function formatBotMessage(message) {
    codeBlocks = []; // Очищаем массив перед каждым новым сообщением

    // Обработка многострочных блоков кода, заключенных в тройные обратные кавычки
    message = message.replace(/```(.*?)\n([\s\S]*?)```/g, function(match, p1, p2) {
        const codeIndex = codeBlocks.length; // Определяем текущий индекс кода
        codeBlocks.push(p2.trim()); // Сохраняем код в массиве

        return `<div class="code-block">
                    <div class="code-header">
                        <span>${p1 || 'Текстовое поле'}</span>
                        <button onclick="copyCodeToClipboard(${codeIndex})">Скопировать код</button>
                    </div>
                    <pre><code>${p2.trim()}</code></pre>
                </div>`;
    });

    // Обработка однострочного кода, заключенного в двойные обратные кавычки
    message = message.replace(/``([^`]+)``/g, '<code>$1</code>');

    // Преобразование строк, начинающихся с "##", в пункты списка
    message = message.replace(/^##\s*(.*)$/gm, '<li>$1</li>');

    // Обработка жирного текста
    message = message.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

    // Обработка текста в курсива (заключенного в одинарные звездочки)
    message = message.replace(/\*(.*?)\*/g, '<em>$1</em>');

    // Если найдены пункты списка, оборачиваем их в <ul>
    if (message.includes('<li>')) {
        message = message.replace(/(<li>.*<\/li>)/g, '<ul>$1</ul>');
    }

    return message;
}


// Функция для экранирования обратных кавычек в строке
function escapeBackticks(str) {
    return str.replace(/`/g, '\\`');
}

// Функция копирования кода в буфер обмена
function copyCodeToClipboard(codeIndex) {
    const code = codeBlocks[codeIndex];
    navigator.clipboard.writeText(code).then(() => {
        alert('Код скопирован в буфер обмена');
    }).catch(err => {
        console.error('Ошибка копирования: ', err);
    });
}

// Функция добавления сообщений в чат и сохранения в localStorage
function addMessageToChat(text, sender, save = true, addContinueButton = false) {
    const chatbox = document.getElementById('chatbox');
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message ' + sender;

    const svgIcon = document.createElement('div');
    svgIcon.innerHTML = sender === 'user' ? userIconSVG() : botIconSVG();

    const messageText = document.createElement('p');
    messageText.innerHTML = text; // Используем innerHTML для поддержки форматирования

    messageDiv.appendChild(svgIcon);
    messageDiv.appendChild(messageText);

    // Удаляем предыдущие кнопки "Продолжить..." перед добавлением новой
    const previousContinueButtons = chatbox.querySelectorAll('.continue-button');
    previousContinueButtons.forEach(button => button.remove());

    // Добавляем кнопку "Продолжить" только для последнего сообщения бота
    if (sender === 'bot' && addContinueButton) {
        const continueButton = document.createElement('button');
        continueButton.textContent = 'Продолжить...';
        continueButton.className = 'continue-button';
        continueButton.addEventListener('click', function() {
            if (!hasSubscription) {
                showModal('helpModal');
            } else {
                sendMessage(text);
            }
        });
        messageDiv.appendChild(continueButton);
    }

    chatbox.appendChild(messageDiv);

    // Используем setTimeout для того, чтобы анимация сработала после добавления в DOM
    setTimeout(() => {
        messageDiv.classList.add('show');
    }, 10);

    chatbox.scrollTop = chatbox.scrollHeight; // Скролл к последнему сообщению

    // Сохраняем сообщение в localStorage
    if (save) {
        const chats = JSON.parse(localStorage.getItem('chats')) || {};
        if (!chats[activeChatId]) {
            chats[activeChatId] = [];
        }
        chats[activeChatId].push({ text, sender });
        localStorage.setItem('chats', JSON.stringify(chats));
    }

    return messageDiv;
}

document.getElementById('clearAllDataButton').addEventListener('click', clearAllData); // Кнопка очистки всех данных

function clearAllData() {
    const confirmation = confirm("Вы уверены, что хотите удалить все данные?");
    if (confirmation) {
        localStorage.clear(); // Удаляем все данные из localStorage
        location.reload(); // Перезагружаем страницу, чтобы обновить состояние
    }
}

// Функционал переключения темы
document.getElementById('themeToggle').addEventListener('click', function() {
    const body = document.body;
    const themeToggleBtn = document.getElementById('themeToggle');
    if (body.classList.contains('dark-mode')) {
        body.classList.remove('dark-mode');
        body.classList.add('light-mode');
        themeToggleBtn.textContent = 'Переключить на темную тему';
    } else {
        body.classList.remove('light-mode');
        body.classList.add('dark-mode');
        themeToggleBtn.textContent = 'Переключить на светлую тему';
    }
});

// Функционал скрытия и показа sidebar
document.getElementById('toggleSidebarButton').addEventListener('click', function() {
    const sidebar = document.querySelector('.sidebar');
    const chatSection = document.querySelector('.chat-section');
    sidebar.classList.toggle('collapsed');
    chatSection.classList.toggle('expanded');
});

document.getElementById('showSidebarButton').addEventListener('click', function() {
    const sidebar = document.querySelector('.sidebar');
    const chatSection = document.querySelector('.chat-section');
    sidebar.classList.remove('collapsed');
    chatSection.classList.remove('expanded');
});

// Функционал создания нового чата
document.getElementById('newChatButton').addEventListener('click', function() {
    // Очищаем чат
    document.getElementById('chatbox').innerHTML = '';
    const chatList = document.getElementById('chatList');
    
    // Создаем новый элемент списка для чата
    const newChatItem = document.createElement('li');
    activeChatId = 'Чат ' + chatCounter++; // Генерация уникального идентификатора для нового чата
    newChatItem.textContent = activeChatId;
    chatList.appendChild(newChatItem);

    // Добавляем событие для загрузки чата
    newChatItem.addEventListener('click', function() {
        setActiveChat(newChatItem.textContent);
    });

    // Сохраняем новый чат
    saveChat(activeChatId, []);
});

// Сохранение чатов в localStorage
function saveChat(chatId, chatContent) {
    const chats = JSON.parse(localStorage.getItem('chats')) || {};
    chats[chatId] = chatContent;
    localStorage.setItem('chats', JSON.stringify(chats));
}

// Добавляем обработчик для удаления чата при нажатии ПКМ
document.getElementById('chatList').addEventListener('contextmenu', function(event) {
    event.preventDefault();  // Отменяем стандартное контекстное меню
    
    const targetChat = event.target;
    
    if (targetChat.tagName === 'LI') {
        const chatName = targetChat.textContent;
        const confirmation = confirm(`Вы уверены, что хотите удалить чат "${chatName}"?`);
        
        if (confirmation) {
            // Удаляем чат из списка чатов
            targetChat.remove();

            // Удаляем чат из localStorage
            const chats = JSON.parse(localStorage.getItem('chats')) || {};
            delete chats[chatName];
            localStorage.setItem('chats', JSON.stringify(chats));

            // Очищаем активный чат, если он был удален
            const chatbox = document.getElementById('chatbox');
            chatbox.innerHTML = '';

            // Сбрасываем активный чат на первый, если удален текущий
            if (chatName === activeChatId) {
                activeChatId = 'Чат 1';
                loadChat(activeChatId);
            }
        }
    }
});

// Функция загрузки чатов при старте
function loadChats() {
    updateChatStatus();
    const chats = JSON.parse(localStorage.getItem('chats')) || {};
    const chatList = document.getElementById('chatList');
    chatList.innerHTML = '';
    chatCounter = Object.keys(chats).length + 1; // Обновляем счетчик на основе количества чатов
    for (const chatId in chats) {
        const chatItem = document.createElement('li');
        chatItem.textContent = chatId;
        chatItem.addEventListener('click', function() {
            setActiveChat(chatId);
        });
        chatList.appendChild(chatItem);
    }
    // Загружаем первый чат при старте
    setActiveChat('Чат 1');
}

// Функция для установки активного чата
function setActiveChat(chatId) {
    activeChatId = chatId;
    loadChat(chatId);
}

// Загрузка содержимого чата
function loadChat(chatId) {
    const chats = JSON.parse(localStorage.getItem('chats')) || {};
    const chatContent = chats[chatId] || [];
    const chatbox = document.getElementById('chatbox');
    chatbox.innerHTML = '';
    chatContent.forEach(message => {
        addMessageToChat(message.text, message.sender, false);
    });
}

// Логика для модального окна "О сайте"
const helpButton = document.getElementById('helpButton');
const modal = document.getElementById('helpModal');
const closeModal = document.querySelector('.modal .close');

helpButton.addEventListener('click', function() {
    modal.style.display = 'block';
});

closeModal.addEventListener('click', function() {
    modal.style.display = 'none';
});

window.addEventListener('click', function(event) {
    if (event.target == modal) {
        modal.style.display = 'none';
    }
});

// Функции для получения SVG иконок
function userIconSVG() {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                <circle cx="12" cy="7" r="4"/>
                <path d="M12 14c-4.418 0-8 2.239-8 5v1h16v-1c0-2.761-3.582-5-8-5z"/>
            </svg>`;
}

function botIconSVG() {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                <circle cx="12" cy="7" r="4"/>
                <path d="M12 14c-4.418 0-8 2.239-8 5v1h16v-1c0-2.761-3.582-5-8-5z"/>
                <path d="M9 14h6v-2H9z"/>
            </svg>`;
}

// Загрузка чатов при старте
document.addEventListener('DOMContentLoaded', loadChats);

// Дополнительные функции для модального окна и промокода
function showModal(modalId) {
    const modal = document.getElementById(modalId);
    modal.style.display = "block";
}


