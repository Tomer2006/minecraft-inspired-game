import { DOMElements } from './domElements.js';

export class Chat {
    constructor(player, multiplayer) {
        this.player = player;
        this.multiplayer = multiplayer;
        this.isOpen = false;
        this.messages = [];
        this.maxMessages = 100; // Maximum messages to keep in history
        this.messageHistory = []; // For navigating through sent messages
        this.historyIndex = -1;
        this.lastMessageTime = 0;
        this.messageCooldown = 1000; // 1 second cooldown between messages

        // Input blocking
        this.keyboardBlocker = null;
        this.mouseBlocker = null;
        this.focusMaintainer = null;

        this.init();
    }

    init() {
        // Set up event listeners
        this.setupEventListeners();

        // Set up multiplayer message handling if multiplayer is available
        if (this.multiplayer) {
            this.setupMultiplayerHandlers();
        }

        // Add welcome message
        this.addSystemMessage('Welcome to the game! Press T to open chat.');
    }

    // Method to update multiplayer instance (for when connecting/disconnecting)
    setMultiplayer(multiplayer) {
        this.multiplayer = multiplayer;

        // Re-setup multiplayer handlers if multiplayer is available
        if (this.multiplayer) {
            this.setupMultiplayerHandlers();
        }
    }

    setupEventListeners() {
        const chatInput = DOMElements.chatInput;

        // Handle chat input
        chatInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                this.sendMessage();
            } else if (e.key === 'Escape') {
                this.closeChat();
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                this.navigateHistory(-1);
            } else if (e.key === 'ArrowDown') {
                e.preventDefault();
                this.navigateHistory(1);
            }
        });

        chatInput.addEventListener('input', (e) => {
            // Reset history navigation on typing
            this.historyIndex = -1;
        });

        // Handle clicking outside chat to close it
        document.addEventListener('click', (e) => {
            if (this.isOpen && !DOMElements.chatContainer.contains(e.target)) {
                this.closeChat();
            }
        });

        // Handle pointer lock changes
        document.addEventListener('pointerlockchange', () => {
            if (document.pointerLockElement) {
                // Pointer locked, close chat
                this.closeChat();
            }
        });
    }

    setupMultiplayerHandlers() {
        if (!this.multiplayer) return;

        // Listen for chat messages from server
        const originalHandleMessage = this.multiplayer.handleMessage.bind(this.multiplayer);
        this.multiplayer.handleMessage = (data) => {
            if (data.type === 'chat-message') {
                this.receiveMessage(data);
            } else {
                originalHandleMessage(data);
            }
        };
    }

    openChat() {
        this.isOpen = true;
        DOMElements.chatContainer.style.display = 'block';
        DOMElements.chatInput.focus();
        DOMElements.chatInput.select();

        // Show recent messages
        this.showChat();

        // Block game input while chat is open
        this.blockGameInput();
    }

    closeChat() {
        if (!this.isOpen) return;

        this.isOpen = false;
        DOMElements.chatContainer.style.display = 'none';
        DOMElements.chatInput.value = '';
        DOMElements.chatInput.blur();
        this.historyIndex = -1;

        // Unblock game input when chat closes
        this.unblockGameInput();
    }

    blockGameInput() {
        // Prevent keyboard events
        this.keyboardBlocker = (event) => {
            // If chat input is focused, allow all typing
            if (DOMElements.chatInput === document.activeElement) {
                return; // Allow all input to reach the focused input field
            }

            // When chat input is not focused, block current game control keybinds
            // Get all keybind values except 'chat' (since that's what opens chat)
            const gameControlKeys = [];
            if (this.player && this.player.keybinds) {
                for (const [action, key] of Object.entries(this.player.keybinds)) {
                    if (action !== 'chat') { // Don't block the chat key itself
                        gameControlKeys.push(key);
                    }
                }
            }

            // Also block number keys for hotbar (these aren't in keybinds but should be blocked)
            gameControlKeys.push('Digit0', 'Digit1', 'Digit2', 'Digit3', 'Digit4',
                               'Digit5', 'Digit6', 'Digit7', 'Digit8', 'Digit9');

            if (gameControlKeys.includes(event.code)) {
                event.preventDefault();
                event.stopImmediatePropagation();
            }
        };

        // Prevent mouse events
        this.mouseBlocker = (event) => {
            // Allow mouse events on chat elements
            if (!DOMElements.chatContainer.contains(event.target)) {
                event.preventDefault();
                event.stopImmediatePropagation();
            }
        };

        // Keep chat input focused while chat is open
        this.focusMaintainer = () => {
            if (this.isOpen && DOMElements.chatInput !== document.activeElement) {
                DOMElements.chatInput.focus();
            }
        };

        // Add event listeners with capture to block before other handlers
        document.addEventListener('keydown', this.keyboardBlocker, true);
        document.addEventListener('keyup', this.keyboardBlocker, true);
        document.addEventListener('keypress', this.keyboardBlocker, true);
        document.addEventListener('mousedown', this.mouseBlocker, true);
        document.addEventListener('mouseup', this.mouseBlocker, true);
        document.addEventListener('mousemove', this.mouseBlocker, true);
        document.addEventListener('click', this.mouseBlocker, true);
        document.addEventListener('contextmenu', this.mouseBlocker, true);
        document.addEventListener('wheel', this.mouseBlocker, true);
        document.addEventListener('focusin', this.focusMaintainer);
    }

    unblockGameInput() {
        // Remove event listeners
        if (this.keyboardBlocker) {
            document.removeEventListener('keydown', this.keyboardBlocker, true);
            document.removeEventListener('keyup', this.keyboardBlocker, true);
            document.removeEventListener('keypress', this.keyboardBlocker, true);
            this.keyboardBlocker = null;
        }

        if (this.mouseBlocker) {
            document.removeEventListener('mousedown', this.mouseBlocker, true);
            document.removeEventListener('mouseup', this.mouseBlocker, true);
            document.removeEventListener('mousemove', this.mouseBlocker, true);
            document.removeEventListener('click', this.mouseBlocker, true);
            document.removeEventListener('contextmenu', this.mouseBlocker, true);
            document.removeEventListener('wheel', this.mouseBlocker, true);
            this.mouseBlocker = null;
        }

        if (this.focusMaintainer) {
            document.removeEventListener('focusin', this.focusMaintainer);
            this.focusMaintainer = null;
        }
    }

    showChat() {
        // Temporarily show chat for a few seconds
        DOMElements.chatContainer.style.display = 'block';
        clearTimeout(this.hideTimeout);

        this.hideTimeout = setTimeout(() => {
            if (!this.isOpen) {
                DOMElements.chatContainer.style.display = 'none';
            }
        }, 5000); // Hide after 5 seconds if not actively chatting
    }

    sendMessage() {
        const message = DOMElements.chatInput.value.trim();
        if (!message) {
            this.closeChat();
            return;
        }

        // Check cooldown
        const now = Date.now();
        if (now - this.lastMessageTime < this.messageCooldown) {
            this.addSystemMessage('Please wait before sending another message.');
            return;
        }

        // Check message length
        if (message.length > 256) {
            this.addSystemMessage('Message too long (max 256 characters).');
            return;
        }

        // Send message via multiplayer
        if (this.multiplayer && this.multiplayer.isConnected) {
            this.multiplayer.sendChatMessage(message);
            this.lastMessageTime = now;

            // Add to local history
            this.messageHistory.unshift(message);
            if (this.messageHistory.length > 50) { // Keep last 50 messages
                this.messageHistory.pop();
            }
        } else {
            this.addSystemMessage('You must be connected to multiplayer to send messages.');
        }

        // Clear input and close chat
        DOMElements.chatInput.value = '';
        this.closeChat();
    }

    receiveMessage(data) {
        const { sender, message, timestamp } = data;
        this.addChatMessage(sender, message, timestamp);
    }

    addChatMessage(sender, message, timestamp = Date.now()) {
        const messageData = {
            type: 'chat',
            sender: sender,
            message: message,
            timestamp: timestamp
        };

        this.messages.push(messageData);

        // Limit message history
        if (this.messages.length > this.maxMessages) {
            this.messages.shift();
        }

        this.updateChatDisplay();

        // Show chat when receiving messages
        if (!this.isOpen) {
            this.showChat();
        }
    }

    addSystemMessage(message) {
        const messageData = {
            type: 'system',
            message: message,
            timestamp: Date.now()
        };

        this.messages.push(messageData);

        // Limit message history
        if (this.messages.length > this.maxMessages) {
            this.messages.shift();
        }

        this.updateChatDisplay();

        // Show chat for system messages
        if (!this.isOpen) {
            this.showChat();
        }
    }

    updateChatDisplay() {
        const chatMessages = DOMElements.chatMessages;
        chatMessages.innerHTML = '';

        // Display last 10 messages or all if fewer
        const displayMessages = this.messages.slice(-10);

        displayMessages.forEach(msg => {
            const messageElement = document.createElement('div');
            messageElement.className = 'chat-message';

            if (msg.type === 'system') {
                messageElement.className += ' system-message';
                messageElement.textContent = msg.message;
            } else {
                const time = new Date(msg.timestamp).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit'
                });
                messageElement.innerHTML = `<span class="chat-time">[${time}]</span> <span class="chat-sender">&lt;${this.escapeHtml(msg.sender)}&gt;</span> ${this.escapeHtml(msg.message)}`;
            }

            chatMessages.appendChild(messageElement);
        });

        // Auto-scroll to bottom
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    navigateHistory(direction) {
        if (this.messageHistory.length === 0) return;

        this.historyIndex += direction;

        // Clamp index
        if (this.historyIndex < -1) {
            this.historyIndex = -1;
        } else if (this.historyIndex >= this.messageHistory.length) {
            this.historyIndex = this.messageHistory.length - 1;
        }

        if (this.historyIndex === -1) {
            DOMElements.chatInput.value = '';
        } else {
            DOMElements.chatInput.value = this.messageHistory[this.historyIndex];
        }

        // Move cursor to end
        setTimeout(() => {
            DOMElements.chatInput.selectionStart = DOMElements.chatInput.selectionEnd = DOMElements.chatInput.value.length;
        }, 0);
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Method to be called by multiplayer when connection status changes
    onConnectionChange(isConnected) {
        if (!isConnected) {
            this.addSystemMessage('Disconnected from server. Messages will not be sent.');
        } else {
            this.addSystemMessage('Connected to server. You can now send messages to other players.');
        }
    }
}
