<!DOCTYPE html>
<html lang="pt-br">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Fifa Simples 2D</title>
    <!-- Firebase SDKs -->
    <script type="module">
        import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
        import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
        import { getFirestore, doc, getDoc, setDoc, updateDoc, onSnapshot, collection, query, where, addDoc, getDocs, deleteDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

        // Variáveis globais para Firebase, acessíveis no escopo global do script
        window.firebaseApp = null;
        window.firebaseAuth = null;
        window.firebaseDb = null;
        window.currentUserId = null;
        window.loggedInUser = null; // Para armazenar o perfil do usuário logado

        // Configuração do Firebase (será fornecida pelo ambiente Canvas)
        const firebaseConfig = JSON.parse(typeof __firebase_config !== 'undefined' ? __firebase_config : '{}');
        const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

        // Inicializa Firebase e autentica
        window.addEventListener('load', async () => {
            try {
                window.firebaseApp = initializeApp(firebaseConfig);
                window.firebaseAuth = getAuth(window.firebaseApp);
                window.firebaseDb = getFirestore(window.firebaseApp);

                // Autenticação: tenta com token customizado ou anonimamente
                if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
                    await signInWithCustomToken(window.firebaseAuth, __initial_auth_token);
                } else {
                    await signInAnonymously(window.firebaseAuth);
                }

                onAuthStateChanged(window.firebaseAuth, (user) => {
                    if (user) {
                        window.currentUserId = user.uid;
                        console.log("Firebase autenticado. UID:", window.currentUserId);
                        // Removed loadUserProfile here, as custom account login/create will set loggedInUser
                    } else {
                        window.currentUserId = null;
                        window.loggedInUser = null; // Ensure loggedInUser is null if auth state changes
                        console.log("Nenhum usuário autenticado no Firebase.");
                        updateScoreDisplay();
                    }
                });

            } catch (error) {
                console.error("Erro ao inicializar Firebase ou autenticar:", error);
                // Exibir mensagem de erro na UI se necessário
            }
        });

        // Custom account functions using Firestore
        window.firebaseCreateUser = async (email, password, username) => {
            if (!window.firebaseDb) return { success: false, message: "Firebase não inicializado." };
            // No need for currentUserId check here, as we are creating a new custom user
            // and not directly linking to the current anonymous Firebase Auth UID in this simplified demo.
            // The currentUserId is still used for Firestore rules and room creation.

            const customUsersCollectionRef = collection(window.firebaseDb, `artifacts/${appId}/public/data/users_custom_auth`);
            try {
                // Check if email already exists
                const q = query(customUsersCollectionRef, where("email", "==", email));
                const querySnapshot = await getDocs(q);
                if (!querySnapshot.empty) {
                    return { success: false, message: "Email já cadastrado." };
                }

                // Create a new custom user document
                const newUserDoc = {
                    username: username,
                    email: email,
                    password: password, // In a real app, hash this password!
                    createdAt: Date.now(),
                    // You could add a field to link to Firebase Auth UID if needed:
                    // firebaseAuthUid: window.currentUserId,
                };
                const newUserRef = await addDoc(customUsersCollectionRef, newUserDoc);

                // Set the loggedInUser for the current session
                window.loggedInUser = { username: username, email: email, docId: newUserRef.id };
                updateScoreDisplay();
                return { success: true, message: "Conta criada com sucesso!" };
            } catch (error) {
                console.error("Erro ao criar conta customizada:", error);
                return { success: false, message: error.message };
            }
        };

        window.firebaseLoginUser = async (email, password) => {
            if (!window.firebaseDb) return { success: false, message: "Firebase não inicializado." };

            const customUsersCollectionRef = collection(window.firebaseDb, `artifacts/${appId}/public/data/users_custom_auth`);
            try {
                const q = query(customUsersCollectionRef, where("email", "==", email), where("password", "==", password));
                const querySnapshot = await getDocs(q);

                if (querySnapshot.empty) {
                    return { success: false, message: "Email ou senha incorretos." };
                }

                // Assuming email/password is unique for custom accounts, get the first match
                const userData = querySnapshot.docs[0].data();
                window.loggedInUser = { username: userData.username, email: userData.email, docId: querySnapshot.docs[0].id };
                updateScoreDisplay();
                return { success: true, message: "Login realizado com sucesso!" };
            } catch (error) {
                console.error("Erro ao fazer login customizado:", error);
                return { success: false, message: error.message };
            }
        };

        window.createFirestoreRoom = async (hostId) => {
            if (!window.firebaseDb) return { success: false, message: "Firebase não inicializado." };
            try {
                const roomsCollectionRef = collection(window.firebaseDb, `artifacts/${appId}/public/data/rooms`);
                const newRoomRef = await addDoc(roomsCollectionRef, {
                    hostId: hostId,
                    guestId: null,
                    status: 'waiting',
                    createdAt: Date.now(),
                    gameState: {
                        player1: { x: 0, y: 0, dx: 0, dy: 0 },
                        player2: { x: 0, y: 0, dx: 0, dy: 0 },
                        ball: { x: 0, y: 0, dx: 0, dy: 0 },
                        score1: 0,
                        score2: 0,
                    }
                });
                return { success: true, roomId: newRoomRef.id };
            } catch (error) {
                console.error("Erro ao criar sala:", error);
                return { success: false, message: error.message };
            }
        };

        window.joinFirestoreRoom = async (roomId, guestId) => {
            if (!window.firebaseDb) return { success: false, message: "Firebase não inicializado." };
            const roomDocRef = doc(window.firebaseDb, `artifacts/${appId}/public/data/rooms/${roomId}`);
            try {
                const docSnap = await getDoc(roomDocRef);
                if (docSnap.exists() && docSnap.data().status === 'waiting' && docSnap.data().hostId !== guestId) {
                    await updateDoc(roomDocRef, {
                        guestId: guestId,
                        status: 'playing'
                    });
                    return { success: true, roomData: docSnap.data() };
                } else if (docSnap.exists() && docSnap.data().hostId === guestId) {
                    return { success: true, roomData: docSnap.data() }; // Host rejoining
                } else {
                    return { success: false, message: "Sala não encontrada ou já cheia." };
                }
            } catch (error) {
                console.error("Erro ao entrar na sala:", error);
                return { success: false, message: error.message };
            }
        };

        window.listenToRoomChanges = (roomId, callback) => {
            if (!window.firebaseDb) return null;
            const roomDocRef = doc(window.firebaseDb, `artifacts/${appId}/public/data/rooms/${roomId}`);
            return onSnapshot(roomDocRef, (docSnap) => {
                if (docSnap.exists()) {
                    callback(docSnap.data());
                } else {
                    callback(null); // Sala foi excluída ou não existe
                }
            }, (error) => {
                console.error("Erro ao ouvir mudanças na sala:", error);
            });
        };

        window.updateFirestoreGameState = async (roomId, gameState) => {
            if (!window.firebaseDb) return;
            const roomDocRef = doc(window.firebaseDb, `artifacts/${appId}/public/data/rooms/${roomId}`);
            try {
                await updateDoc(roomDocRef, { gameState: gameState });
            } catch (error) {
                console.error("Erro ao atualizar estado do jogo no Firestore:", error);
            }
        };

        window.deleteFirestoreRoom = async (roomId) => {
            if (!window.firebaseDb) return;
            const roomDocRef = doc(window.firebaseDb, `artifacts/${appId}/public/data/rooms/${roomId}`);
            try {
                await deleteDoc(roomDocRef);
                console.log("Sala excluída:", roomId);
            } catch (error) {
                console.error("Erro ao excluir sala:", error);
            }
        };
    </script>
    <style>
        body {
            margin: 0;
            overflow: hidden;
            font-family: 'Inter', sans-serif;
            background-color: #222;
            color: #eee;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
        }
        canvas {
            background-color: #4CAF50; /* Cor do campo de futebol */
            border: 5px solid #555;
            display: block;
            max-width: 90vw; /* Largura fluida */
            max-height: 80vh; /* Altura fluida */
            aspect-ratio: 16 / 9; /* Mantém a proporção de um campo de futebol */
            border-radius: 10px;
            box-shadow: 0 0 20px rgba(0, 0, 0, 0.5);
        }
        #ui {
            position: absolute;
            top: 10px;
            padding: 10px 20px;
            background: rgba(0, 0, 0, 0.7);
            border-radius: 8px;
            display: flex;
            gap: 20px;
            font-size: 24px;
            font-weight: bold;
            color: #fff;
            border: 1px solid #444;
        }
        #main-menu, #message-box, #account-modal, #online-lobby-modal, #kickoff-message {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: rgba(0, 0, 0, 0.9);
            padding: 30px;
            border-radius: 15px;
            border: 3px solid #f00;
            text-align: center;
            font-size: 28px;
            color: #fff;
            z-index: 1000;
            box-shadow: 0 0 30px rgba(255, 0, 0, 0.7);
            display: flex;
            flex-direction: column;
            gap: 15px;
        }
        #main-menu button, #message-box button, #account-modal button, #online-lobby-modal button {
            background-color: #4CAF50;
            color: white;
            padding: 12px 25px;
            border: none;
            border-radius: 8px;
            cursor: pointer;
            font-size: 20px;
            margin-top: 10px;
            transition: background-color 0.3s ease, transform 0.1s ease;
            box-shadow: 0 4px 10px rgba(0, 0, 0, 0.3);
        }
        #main-menu button:hover, #message-box button:hover, #account-modal button:hover, #online-lobby-modal button:hover {
            background-color: #45a049;
            transform: translateY(-2px);
        }
        #main-menu button:active, #message-box button:active, #account-modal button:active, #online-lobby-modal button:active {
            transform: translateY(0);
        }
        #gameCanvas {
            display: none; /* Esconde o canvas inicialmente */
        }
        #online-message {
            font-size: 18px;
            color: #ffcc00;
            margin-top: 10px;
        }
        #account-modal input, #online-lobby-modal input {
            padding: 10px;
            margin-bottom: 10px;
            border-radius: 5px;
            border: 1px solid #ccc;
            background-color: #333;
            color: #eee;
            font-size: 18px;
        }
        #account-modal p, #online-lobby-modal p {
            font-size: 18px;
            color: #ccc;
        }
        #logged-in-user {
            font-size: 18px;
            color: #00ff00;
            margin-top: 10px;
        }
        #room-code-display {
            font-size: 24px;
            color: #fff;
            margin-top: 10px;
            word-break: break-all; /* Quebra texto longo */
        }
        #player-list {
            list-style: none;
            padding: 0;
            font-size: 20px;
        }
        #player-list li {
            margin-bottom: 5px;
        }
        #kickoff-message {
            background: rgba(0, 0, 0, 0.7);
            border: 2px solid #fff;
            color: #fff;
            font-size: 40px;
            font-weight: bold;
            padding: 20px 40px;
            border-radius: 10px;
            display: none; /* Hidden by default */
        }
    </style>
</head>
<body>
    <div id="ui">
        <span>Jogador: <span id="player-score">0</span></span>
        <span>IA: <span id="ai-score">0</span></span>
        <span id="logged-in-user" style="display: none;"></span>
    </div>

    <canvas id="gameCanvas"></canvas>

    <div id="main-menu">
        <h1>Fifa Simples 2D</h1>
        <button id="play-offline-button">Jogar Offline</button>
        <button id="play-online-button">Jogar Online</button>
        <button id="create-account-button">Criar Conta</button>
        <button id="login-button">Fazer Login</button>
        <p id="online-message" style="display: none;">O modo online requer um servidor e não está disponível nesta demonstração.</p>
    </div>

    <div id="account-modal" style="display: none;">
        <h2 id="account-modal-title"></h2>
        <input type="text" id="username-input" placeholder="Usuário">
        <input type="email" id="email-input" placeholder="Email (para login)">
        <input type="password" id="password-input" placeholder="Senha">
        <p id="account-message" style="color: red;"></p>
        <button id="submit-account-button"></button>
        <button id="cancel-account-button">Cancelar</button>
    </div>

    <div id="online-lobby-modal" style="display: none;">
        <h2>Lobby Online</h2>
        <button id="create-room-button">Criar Sala</button>
        <input type="text" id="join-room-input" placeholder="Código da Sala">
        <button id="join-room-button">Entrar na Sala</button>
        <p id="lobby-message"></p>
        <p id="room-code-display" style="display: none;"></p>
        <ul id="player-list"></ul>
        <button id="start-online-game-button" style="display: none;">Iniciar Jogo Online</button>
        <button id="leave-room-button" style="display: none;">Sair da Sala</button>
        <button id="cancel-lobby-button">Voltar ao Menu</button>
    </div>

    <div id="message-box" class="message-box">
        <p id="message-text"></p>
        <button id="restart-button">Reiniciar Jogo</button>
    </div>

    <div id="kickoff-message" style="display: none;">Saída de Bola!</div>

    <script>
        // --- Configurações do Canvas e Contexto ---
        const canvas = document.getElementById('gameCanvas');
        const ctx = canvas.getContext('2d');

        // --- Variáveis do Jogo ---
        let gameWidth, gameHeight;
        let player, aiPlayer, ball;
        let playerScore = 0;
        let aiScore = 0;
        let gameActive = false; // O jogo não está ativo até iniciar pelo menu
        let keys = {};
        let kickCooldown = 0; // Tempo de espera entre chutes
        let animationFrameId; // Para controlar o loop de animação
        let isKickoffActive = false; // Para controlar o estado de saída de bola

        let isOnlineGame = false;
        let currentRoomId = null;
        let isHost = false;
        let unsubscribeFromRoom = null; // Para unsubscribing do listener do Firestore

        // UI Elements
        const playerScoreDisplay = document.getElementById('player-score');
        const aiScoreDisplay = document.getElementById('ai-score');
        const messageBox = document.getElementById('message-box');
        const messageText = document.getElementById('message-text');
        const restartButton = document.getElementById('restart-button');
        const mainMenu = document.getElementById('main-menu');
        const playOfflineButton = document.getElementById('play-offline-button');
        const playOnlineButton = document.getElementById('play-online-button');
        const createAccountButton = document.getElementById('create-account-button');
        const loginButton = document.getElementById('login-button');
        const onlineMessage = document.getElementById('online-message');
        const uiDisplay = document.getElementById('ui');
        const loggedInUserDisplay = document.getElementById('logged-in-user');
        const kickoffMessage = document.getElementById('kickoff-message'); // Novo elemento de mensagem de saída de bola

        // Account Modal Elements
        const accountModal = document.getElementById('account-modal');
        const accountModalTitle = document.getElementById('account-modal-title');
        const usernameInput = document.getElementById('username-input');
        const emailInput = document.getElementById('email-input'); // Novo input de email
        const passwordInput = document.getElementById('password-input');
        const accountMessage = document.getElementById('account-message');
        const submitAccountButton = document.getElementById('submit-account-button');
        const cancelAccountButton = document.getElementById('cancel-account-button');

        // Online Lobby Elements
        const onlineLobbyModal = document.getElementById('online-lobby-modal');
        const createRoomButton = document.getElementById('create-room-button');
        const joinRoomInput = document.getElementById('join-room-input');
        const joinRoomButton = document.getElementById('join-room-button');
        const lobbyMessage = document.getElementById('lobby-message');
        const roomCodeDisplay = document.getElementById('room-code-display');
        const playerList = document.getElementById('player-list');
        const startOnlineGameButton = document.getElementById('start-online-game-button');
        const leaveRoomButton = document.getElementById('leave-room-button');
        const cancelLobbyButton = document.getElementById('cancel-lobby-button');


        // --- Constantes do Jogo ---
        const PLAYER_SIZE_RATIO = 0.03; // Proporção do tamanho do jogador em relação à altura do campo
        const BALL_RADIUS_RATIO = 0.01; // Proporção do raio da bola em relação à altura do campo
        const PLAYER_SPEED_RATIO = 0.005; // Proporção da velocidade do jogador
        const BALL_FRICTION = 0.98; // Atrito da bola
        const COLLISION_DAMPING = 0.8; // Amortecimento da colisão
        const MAX_BALL_SPEED = 15; // Velocidade máxima da bola
        const AI_SPEED_FACTOR = 0.8; // Velocidade da IA em relação ao jogador
        const GOAL_WIDTH_RATIO = 0.02; // Largura do poste do gol
        const GOAL_HEIGHT_RATIO = 0.2; // Altura do gol
        const KICK_POWER = 15; // Força do chute
        const KICK_COOLDOWN_TIME = 30; // Tempo de recarga do chute em frames (aprox. 0.5 segundos)
        const GOALKEEPER_SPEED_FACTOR = 0.6; // Velocidade do goleiro da IA
        const DRIBBLE_PUSH_FACTOR = 0.05; // Força do "drible" ao empurrar a bola
        const KICKOFF_DURATION = 1500; // Duração da mensagem de saída de bola em ms

        // --- Classes de Objetos do Jogo ---
        class Player {
            constructor(x, y, color, isAI = false, isGoalie = false) {
                this.x = x;
                this.y = y;
                this.radius = gameHeight * PLAYER_SIZE_RATIO;
                this.color = color;
                this.speed = gameHeight * PLAYER_SPEED_RATIO;
                this.dx = 0;
                this.dy = 0;
                this.isAI = isAI;
                this.isGoalie = isGoalie; // Novo: indica se é um goleiro
                this.facingAngle = 0; // Ângulo para onde o jogador está "olhando"
            }

            draw() {
                // Desenha o corpo (círculo principal)
                ctx.beginPath();
                ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
                ctx.fillStyle = this.color;
                ctx.fill();
                ctx.strokeStyle = '#333';
                ctx.lineWidth = 2;
                ctx.stroke();
                ctx.closePath();

                // Desenha a "cabeça" (círculo menor no topo)
                const headRadius = this.radius * 0.5; // Reduzido para ser mais discreto
                ctx.beginPath();
                ctx.arc(this.x + this.radius * Math.cos(this.facingAngle) * 0.7, // Ajusta posição da cabeça
                        this.y + this.radius * Math.sin(this.facingAngle) * 0.7,
                        headRadius, 0, Math.PI * 2);
                ctx.fillStyle = 'white'; // Cor da cabeça
                ctx.fill();
                ctx.strokeStyle = '#333';
                ctx.lineWidth = 1;
                ctx.stroke();
                ctx.closePath();

                // Desenha a direção que o jogador está olhando (linha na frente)
                ctx.beginPath();
                ctx.moveTo(this.x, this.y);
                ctx.lineTo(
                    this.x + this.radius * Math.cos(this.facingAngle) * 1.2, // Linha um pouco maior
                    this.y + this.radius * Math.sin(this.facingAngle) * 1.2
                );
                ctx.strokeStyle = 'rgba(255,255,255,0.8)';
                ctx.lineWidth = 2;
                ctx.stroke();
                ctx.closePath();
            }

            update() {
                if (this.isGoalie) {
                    // Lógica do Goleiro da IA: move-se horizontalmente para bloquear a bola
                    const targetY = ball.y;
                    const goalieSpeed = this.speed * GOALKEEPER_SPEED_FACTOR;

                    if (targetY < this.y) {
                        this.dy = -goalieSpeed;
                    } else if (targetY > this.y) {
                        this.dy = goalieSpeed;
                    } else {
                        this.dy = 0;
                    }
                    this.dx = 0; // Goleiro só se move no eixo Y

                    this.y += this.dy;

                    // Limita o goleiro à área do gol
                    const goalHeight = gameHeight * GOAL_HEIGHT_RATIO;
                    this.y = Math.max(gameHeight / 2 - goalHeight / 2 + this.radius, Math.min(gameHeight / 2 + goalHeight / 2 - this.radius, this.y));
                    
                    // Mantém o goleiro na posição X do gol
                    if (this.color === '#3366FF') { // Goleiro da IA (azul, lado direito)
                        this.x = gameWidth - (gameWidth * 0.15 / 2); // Centraliza no gol da IA
                    } else { // Goleiro do jogador (laranja, lado esquerdo)
                        this.x = gameWidth * 0.15 / 2; // Centraliza no gol do jogador
                    }
                    
                    // A IA goleiro sempre "olha" para a bola
                    this.facingAngle = Math.atan2(ball.y - this.y, ball.x - this.x);

                } else { // Jogadores de campo (jogador e IA)
                    this.dx = 0;
                    this.dy = 0;

                    if (!this.isAI || isOnlineGame) { // Lógica de movimento do jogador ou online
                        if (keys['KeyW'] || keys['ArrowUp']) this.dy = -this.speed;
                        if (keys['KeyS'] || keys['ArrowDown']) this.dy = this.speed;
                        if (keys['KeyA'] || keys['ArrowLeft']) this.dx = -this.speed;
                        if (keys['KeyD'] || keys['ArrowRight']) this.dx = this.speed;
                    } else { // Lógica de IA para jogadores de campo (offline)
                        // AI balanceada: persegue a bola, mas com um pouco de aleatoriedade e atraso
                        const targetX = ball.x;
                        const targetY = ball.y;

                        // Adiciona um pequeno atraso ou imprecisão à IA
                        const randomOffset = (Math.random() - 0.5) * gameHeight * 0.05; // Pequeno desvio
                        const angle = Math.atan2((targetY + randomOffset) - this.y, (targetX + randomOffset) - this.x);
                        
                        this.dx = Math.cos(angle) * this.speed * AI_SPEED_FACTOR;
                        this.dy = Math.sin(angle) * this.speed * AI_SPEED_FACTOR;

                        // Adiciona uma chance da IA se mover para uma posição defensiva se a bola estiver longe
                        const distanceToBall = Math.sqrt(Math.pow(this.x - ball.x, 2) + Math.pow(this.y - ball.y, 2));
                        if (distanceToBall > gameWidth * 0.3 && Math.random() < 0.01) { // Se a bola estiver longe, 1% de chance de ir para a posição defensiva
                            if (this.color === '#3366FF') { // IA azul (lado direito)
                                this.dx = (gameWidth * 0.75 - this.x) > 0 ? this.speed * AI_SPEED_FACTOR : -this.speed * AI_SPEED_FACTOR;
                                this.dy = (gameHeight / 2 - this.y) > 0 ? this.speed * AI_SPEED_FACTOR : -this.speed * AI_SPEED_FACTOR;
                            }
                        }
                    }

                    // Normaliza a velocidade se estiver se movendo diagonalmente
                    if (this.dx !== 0 && this.dy !== 0) {
                        const magnitude = Math.sqrt(this.dx * this.dx + this.dy * this.dy);
                        this.dx = (this.dx / magnitude) * this.speed;
                        this.dy = (this.dy / magnitude) * this.speed;
                    }

                    this.x += this.dx;
                    this.y += this.dy;

                    // Limita o jogador aos limites do campo
                    this.x = Math.max(this.radius, Math.min(gameWidth - this.radius, this.x));
                    this.y = Math.max(this.radius, Math.min(gameHeight - this.radius, this.y));

                    // Atualiza o ângulo de direção com base no movimento ou na bola para a IA
                    if (!this.isAI && (this.dx !== 0 || this.dy !== 0)) {
                        this.facingAngle = Math.atan2(this.dy, this.dx);
                    } else if (this.isAI) {
                        this.facingAngle = Math.atan2(ball.y - this.y, ball.x - this.x);
                    }

                    // Lógica de Drible (apenas para jogador controlável e não goleiro)
                    if (!this.isAI && !this.isGoalie && (keys['ShiftLeft'] || keys['ShiftRight'])) {
                        const distanceToBall = Math.sqrt(Math.pow(this.x - ball.x, 2) + Math.pow(this.y - ball.y, 2));
                        const dribbleThreshold = this.radius + ball.radius + 5; // Proximidade para drible

                        if (distanceToBall < dribbleThreshold) {
                            // Aplica uma força suave à bola na direção do movimento do jogador
                            ball.dx += this.dx * DRIBBLE_PUSH_FACTOR;
                            ball.dy += this.dy * DRIBBLE_PUSH_FACTOR;
                        }
                    }
                }
            }

            // Novo método para chutar a bola
            kick(ball) {
                const distance = Math.sqrt(Math.pow(this.x - ball.x, 2) + Math.pow(this.y - ball.y, 2));
                // Verifica se o jogador está perto da bola e se o chute não está em cooldown
                if (distance < this.radius + ball.radius + 5 && kickCooldown <= 0) {
                    const angle = this.facingAngle; // Chuta na direção que o jogador está olhando

                    ball.dx = KICK_POWER * Math.cos(angle);
                    ball.dy = KICK_POWER * Math.sin(angle);

                    kickCooldown = KICK_COOLDOWN_TIME; // Inicia o cooldown
                }
            }
        }

        class Ball {
            constructor(x, y) {
                this.x = x;
                this.y = y;
                this.radius = gameHeight * BALL_RADIUS_RATIO;
                this.dx = 0;
                this.dy = 0;
            }

            draw() {
                ctx.beginPath();
                ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
                ctx.fillStyle = '#fff'; // Bola branca
                ctx.fill();
                ctx.strokeStyle = '#333';
                ctx.lineWidth = 1;
                ctx.stroke();
                ctx.closePath();

                // Desenha os gomos da bola para um visual mais FIFA-like
                ctx.beginPath();
                ctx.arc(this.x, this.y, this.radius * 0.7, 0, Math.PI * 2);
                ctx.strokeStyle = '#666';
                ctx.lineWidth = 1;
                ctx.stroke();
                ctx.closePath();

                ctx.beginPath();
                ctx.moveTo(this.x - this.radius, this.y);
                ctx.lineTo(this.x + this.radius, this.y);
                ctx.moveTo(this.x, this.y - this.radius);
                ctx.lineTo(this.x, this.y + this.radius);
                ctx.strokeStyle = '#666';
                ctx.lineWidth = 1;
                ctx.stroke();
                ctx.closePath();
            }

            update() {
                this.x += this.dx;
                this.y += this.dy;

                // Atrito
                this.dx *= BALL_FRICTION;
                this.dy *= BALL_FRICTION;

                // Limita a velocidade máxima da bola
                const currentSpeed = Math.sqrt(this.dx * this.dx + this.dy * this.dy);
                if (currentSpeed > MAX_BALL_SPEED) {
                    this.dx = (this.dx / currentSpeed) * MAX_BALL_SPEED;
                    this.dy = (this.dy / currentSpeed) * MAX_BALL_SPEED;
                }

                // Colisão com as paredes do campo (exceto áreas de gol)
                const goalHeight = gameHeight * GOAL_HEIGHT_RATIO;

                // Colisão com paredes laterais
                if (this.x + this.radius > gameWidth) {
                    if (this.y > gameHeight / 2 - goalHeight / 2 && this.y < gameHeight / 2 + goalHeight / 2) {
                        // Está na área do gol, não colide, espera checkGoal
                    } else {
                        this.dx *= -1;
                        this.x = gameWidth - this.radius;
                    }
                } else if (this.x - this.radius < 0) {
                    if (this.y > gameHeight / 2 - goalHeight / 2 && this.y < gameHeight / 2 + goalHeight / 2) {
                        // Está na área do gol, não colide, espera checkGoal
                    } else {
                        this.dx *= -1;
                        this.x = this.radius;
                    }
                }

                // Colisão com paredes superior e inferior
                if (this.y + this.radius > gameHeight) {
                    this.dy *= -1;
                    this.y = gameHeight - this.radius;
                } else if (this.y - this.radius < 0) {
                    this.dy *= -1;
                    this.y = this.radius;
                }

                // Colisão com os postes do gol
                const goalPostRadius = gameHeight * GOAL_WIDTH_RATIO / 2;

                // Posições dos postes do gol do jogador (direita)
                const playerGoalPostTop = { x: gameWidth, y: gameHeight / 2 - goalHeight / 2, radius: goalPostRadius };
                const playerGoalPostBottom = { x: gameWidth, y: gameHeight / 2 + goalHeight / 2, radius: goalPostRadius };

                // Posições dos postes do gol da IA (esquerda)
                const aiGoalPostTop = { x: 0, y: gameHeight / 2 - goalHeight / 2, radius: goalPostRadius };
                const aiGoalPostBottom = { x: 0, y: gameHeight / 2 + goalHeight / 2, radius: goalPostRadius };

                [playerGoalPostTop, playerGoalPostBottom, aiGoalPostTop, aiGoalPostBottom].forEach(post => {
                    const dx = this.x - post.x;
                    const dy = this.y - post.y;
                    const distance = Math.sqrt(dx * dx + dy * dy);

                    if (distance < this.radius + post.radius) {
                        // Colisão detectada
                        const normalX = dx / distance;
                        const normalY = dy / distance;
                        const overlap = (this.radius + post.radius) - distance;

                        // Move a bola para fora da colisão
                        this.x += normalX * overlap;
                        this.y += normalY * overlap;

                        // Reflete a velocidade
                        const dotProduct = this.dx * normalX + this.dy * normalY;
                        this.dx -= 2 * dotProduct * normalX;
                        this.dy -= 2 * dotProduct * normalY;

                        // Aplica algum amortecimento
                        this.dx *= COLLISION_DAMPING;
                        this.dy *= COLLISION_DAMPING;
                    }
                });
            }
        }

        // --- Funções de Inicialização e Desenho ---
        function setupGame() {
            gameWidth = canvas.width;
            gameHeight = canvas.height;

            player = new Player(gameWidth * 0.25, gameHeight / 2, '#FF5733'); // Laranja para o jogador
            aiPlayer = new Player(gameWidth * 0.75, gameHeight / 2, '#3366FF', true); // Azul para a IA

            // Goleiros (posição centralizada na linha do gol)
            playerGoalie = new Player(gameWidth * 0.05, gameHeight / 2, '#FF5733', false, true); // Goleiro do jogador
            aiGoalie = new Player(gameWidth * 0.95, gameHeight / 2, '#3366FF', true, true); // Goleiro da IA

            ball = new Ball(gameWidth / 2, gameHeight / 2);

            playerScore = 0;
            aiScore = 0;
            updateScoreDisplay();
            kickCooldown = 0; // Reseta o cooldown ao reiniciar
        }

        function drawField() {
            // Linhas do campo
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 3;

            // Linha central
            ctx.beginPath();
            ctx.moveTo(gameWidth / 2, 0);
            ctx.lineTo(gameWidth / 2, gameHeight);
            ctx.stroke();
            ctx.closePath();

            // Círculo central
            ctx.beginPath();
            ctx.arc(gameWidth / 2, gameHeight / 2, gameHeight * 0.1, 0, Math.PI * 2);
            ctx.stroke();
            ctx.closePath();

            // Ponto central
            ctx.beginPath();
            ctx.arc(gameWidth / 2, gameHeight / 2, 5, 0, Math.PI * 2);
            ctx.fillStyle = '#fff';
            ctx.fill();
            ctx.closePath();

            // Áreas de gol (grandes áreas)
            const penaltyAreaWidth = gameWidth * 0.2;
            const penaltyAreaHeight = gameHeight * 0.7;

            // Área do jogador
            ctx.strokeRect(0, gameHeight / 2 - penaltyAreaHeight / 2, penaltyAreaWidth, penaltyAreaHeight);
            // Área da IA
            ctx.strokeRect(gameWidth - penaltyAreaWidth, gameHeight / 2 - penaltyAreaHeight / 2, penaltyAreaWidth, penaltyAreaHeight);

            // Pequenas áreas (área do goleiro)
            const smallAreaWidth = gameWidth * 0.1;
            const smallAreaHeight = gameHeight * 0.4;

            // Pequena área do jogador
            ctx.strokeRect(0, gameHeight / 2 - smallAreaHeight / 2, smallAreaWidth, smallAreaHeight);
            // Pequena área da IA
            ctx.strokeRect(gameWidth - smallAreaWidth, gameHeight / 2 - smallAreaHeight / 2, smallAreaWidth, smallAreaHeight);

            // Gols (postes)
            const goalPostRadius = gameHeight * GOAL_WIDTH_RATIO / 2;
            const goalHeight = gameHeight * GOAL_HEIGHT_RATIO;

            // Gol do jogador (direita) - Linha de gol
            ctx.beginPath();
            ctx.moveTo(gameWidth, gameHeight / 2 - goalHeight / 2);
            ctx.lineTo(gameWidth, gameHeight / 2 + goalHeight / 2);
            ctx.stroke();
            ctx.closePath();
            // Postes do gol do jogador
            ctx.beginPath();
            ctx.arc(gameWidth, gameHeight / 2 - goalHeight / 2, goalPostRadius, 0, Math.PI * 2);
            ctx.fillStyle = '#fff'; ctx.fill();
            ctx.arc(gameWidth, gameHeight / 2 + goalHeight / 2, goalPostRadius, 0, Math.PI * 2);
            ctx.fillStyle = '#fff'; ctx.fill();
            ctx.closePath();


            // Gol da IA (esquerda) - Linha de gol
            ctx.beginPath();
            ctx.moveTo(0, gameHeight / 2 - goalHeight / 2);
            ctx.lineTo(0, gameHeight / 2 + goalHeight / 2);
            ctx.stroke();
            ctx.closePath();
            // Postes do gol da IA
            ctx.beginPath();
            ctx.arc(0, gameHeight / 2 - goalHeight / 2, goalPostRadius, 0, Math.PI * 2);
            ctx.fillStyle = '#fff'; ctx.fill();
            ctx.arc(0, gameHeight / 2 + goalHeight / 2, goalPostRadius, 0, Math.PI * 2);
            ctx.fillStyle = '#fff'; ctx.fill();
            ctx.closePath();
        }

        // --- Lógica de Colisão ---
        function checkCollision(obj1, obj2) {
            const dx = obj1.x - obj2.x;
            const dy = obj1.y - obj2.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            return distance < obj1.radius + obj2.radius;
        }

        function resolveCollision(playerObj, ballObj) {
            const dx = ballObj.x - playerObj.x;
            const dy = ballObj.y - playerObj.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            // Normalização do vetor de colisão
            const normalX = dx / distance;
            const normalY = dy / distance;

            // Movimento para fora da colisão para evitar que fiquem presos
            const overlap = (playerObj.radius + ballObj.radius) - distance;
            ballObj.x += normalX * overlap / 2;
            ballObj.y += normalY * overlap / 2;
            playerObj.x -= normalX * overlap / 2;
            playerObj.y -= normalY * overlap / 2;

            // Calculate relative velocity
            const relVelX = ballObj.dx - playerObj.dx;
            const relVelY = ballObj.dy - playerObj.dy;

            // Calculate velocity along the normal
            const velAlongNormal = relVelX * normalX + relVelY * normalY;

            // Do not resolve if velocities are separating
            if (velAlongNormal > 0) return;

            // Calculate impulse scalar
            const restitution = COLLISION_DAMPING; // Use damping as restitution
            const impulseScalar = -(1 + restitution) * velAlongNormal;

            // Apply impulse to ball
            ballObj.dx += impulseScalar * normalX;
            ballObj.dy += impulseScalar * normalY;

            // Add some of player's velocity to ball (for pushing/dribbling feel)
            ballObj.dx += playerObj.dx * 0.2; // Small push
            ballObj.dy += playerObj.dy * 0.2; // Small push

            // Limit ball speed
            const currentSpeed = Math.sqrt(ballObj.dx * ballObj.dx + ballObj.dy * ballObj.dy);
            if (currentSpeed > MAX_BALL_SPEED) {
                ballObj.dx = (ballObj.dx / currentSpeed) * MAX_BALL_SPEED;
                ballObj.dy = (ballObj.dy / currentSpeed) * MAX_BALL_SPEED;
            }
        }

        function checkGoal() {
            const goalHeight = gameHeight * GOAL_HEIGHT_RATIO;
            const goalPostRadius = gameHeight * GOAL_WIDTH_RATIO / 2;

            // Gol do Jogador (lado direito - IA marca)
            if (ball.x + ball.radius > gameWidth - goalPostRadius &&
                ball.y > gameHeight / 2 - goalHeight / 2 &&
                ball.y < gameHeight / 2 + goalHeight / 2) {
                aiScore++;
                updateScoreDisplay();
                resetBall();
                if (aiScore >= 5) { // Condição de vitória simples
                    gameOver("IA Venceu!");
                } else {
                    showKickoffMessage(); // Mostra mensagem de saída de bola
                }
            }

            // Gol da IA (lado esquerdo - Jogador marca)
            if (ball.x - ball.radius < goalPostRadius &&
                ball.y > gameHeight / 2 - goalHeight / 2 &&
                ball.y < gameHeight / 2 + goalHeight / 2) {
                playerScore++;
                updateScoreDisplay();
                resetBall();
                if (playerScore >= 5) { // Condição de vitória simples
                    gameOver("Você Venceu!");
                } else {
                    showKickoffMessage(); // Mostra mensagem de saída de bola
                }
            }
        }

        function resetBall() {
            ball.x = gameWidth / 2;
            ball.y = gameHeight / 2;
            ball.dx = 0;
            ball.dy = 0;
            // Reposiciona os jogadores após o gol
            player.x = gameWidth * 0.25;
            player.y = gameHeight / 2;
            aiPlayer.x = gameWidth * 0.75;
            aiPlayer.y = gameHeight / 2;
            playerGoalie.y = gameHeight / 2;
            aiGoalie.y = gameHeight / 2;
            kickCooldown = 0; // Reseta o cooldown do chute
        }

        function updateScoreDisplay() {
            playerScoreDisplay.textContent = playerScore;
            aiScoreDisplay.textContent = aiScore;
            if (window.loggedInUser && window.loggedInUser.username) {
                loggedInUserDisplay.textContent = `Usuário: ${window.loggedInUser.username}`;
                loggedInUserDisplay.style.display = 'block';
            } else {
                loggedInUserDisplay.style.display = 'none';
            }
        }

        const showKickoffMessage = () => {
            isKickoffActive = true;
            kickoffMessage.style.display = 'flex';
            setTimeout(() => {
                kickoffMessage.style.display = 'none';
                isKickoffActive = false;
            }, KICKOFF_DURATION);
        };

        const gameOver = (message) => {
            gameActive = false;
            messageText.textContent = message;
            messageBox.style.display = 'flex';
            kickoffMessage.style.display = 'none'; // Garante que a mensagem de saída de bola esteja oculta
            cancelAnimationFrame(animationFrameId);

            if (isOnlineGame && isHost && currentRoomId) {
                window.deleteFirestoreRoom(currentRoomId);
            }
        };

        const startGameOffline = () => {
            isOnlineGame = false;
            mainMenu.style.display = 'none';
            accountModal.style.display = 'none';
            onlineLobbyModal.style.display = 'none';
            messageBox.style.display = 'none'; // Garante que a caixa de mensagem esteja oculta
            kickoffMessage.style.display = 'none'; // Garante que a mensagem de saída de bola esteja oculta
            canvas.style.display = 'block';
            uiDisplay.style.display = 'flex';
            setupGame();
            gameActive = true;
            showKickoffMessage(); // Mostra a mensagem de saída de bola no início do jogo
            gameLoop();
        };

        const showOnlineMessage = () => {
            onlineMessage.style.display = 'block';
            setTimeout(() => {
                onlineMessage.style.display = 'none';
            }, 3000);
        };

        const restartGame = () => {
            messageBox.style.display = 'none';
            startGameOffline();
        };

        const showAccountModal = (type) => {
            mainMenu.style.display = 'none';
            messageBox.style.display = 'none'; // Garante que a caixa de mensagem esteja oculta
            kickoffMessage.style.display = 'none'; // Garante que a mensagem de saída de bola esteja oculta
            accountModal.style.display = 'flex';
            usernameInput.value = '';
            emailInput.value = '';
            passwordInput.value = '';
            accountMessage.textContent = '';

            if (type === 'create') {
                accountModalTitle.textContent = 'Criar Conta';
                submitAccountButton.textContent = 'Criar';
                submitAccountButton.onclick = createAccount;
            } else if (type === 'login') {
                accountModalTitle.textContent = 'Fazer Login';
                submitAccountButton.textContent = 'Login';
                submitAccountButton.onclick = loginAccount;
            }
        };

        const createAccount = () => {
            const username = usernameInput.value.trim();
            const email = emailInput.value.trim();
            const password = passwordInput.value.trim();

            if (username.length < 3 || email.length < 5 || password.length < 6) {
                accountMessage.textContent = 'Usuário (min 3), Email (min 5) e Senha (min 6) devem ser válidos.';
                return;
            }

            window.firebaseCreateUser(email, password, username).then(res => {
                accountMessage.textContent = res.message;
                accountMessage.style.color = res.success ? 'green' : 'red';
                if (res.success) {
                    setTimeout(() => {
                        accountModal.style.display = 'none';
                        mainMenu.style.display = 'flex';
                        updateScoreDisplay();
                    }, 1500);
                }
            });
        };

        const loginAccount = () => {
            const email = emailInput.value.trim();
            const password = passwordInput.value.trim();

            if (email.length < 5 || password.length < 6) {
                accountMessage.textContent = 'Email e Senha devem ser válidos.';
                return;
            }

            window.firebaseLoginUser(email, password).then(res => {
                accountMessage.textContent = res.message;
                accountMessage.style.color = res.success ? 'green' : 'red';
                if (res.success) {
                    setTimeout(() => {
                        accountModal.style.display = 'none';
                        mainMenu.style.display = 'flex';
                        updateScoreDisplay();
                    }, 1500);
                }
            });
        };

        const showOnlineLobby = () => {
            if (!window.currentUserId) {
                onlineMessage.textContent = "Você precisa estar logado para jogar online.";
                onlineMessage.style.display = 'block';
                setTimeout(() => { onlineMessage.style.display = 'none'; }, 3000);
                return;
            }
            mainMenu.style.display = 'none';
            messageBox.style.display = 'none'; // Garante que a caixa de mensagem esteja oculta
            kickoffMessage.style.display = 'none'; // Garante que a mensagem de saída de bola esteja oculta
            onlineLobbyModal.style.display = 'flex';
            lobbyMessage.textContent = "";
            roomCodeDisplay.style.display = 'none';
            startOnlineGameButton.style.display = 'none';
            leaveRoomButton.style.display = 'none';
            playerList.innerHTML = ''; // Limpa a lista de jogadores
        };

        async function createOnlineRoom() {
            if (!window.currentUserId) {
                lobbyMessage.textContent = "Erro: UID do usuário não disponível.";
                return;
            }
            lobbyMessage.textContent = "Criando sala...";
            const response = await window.createFirestoreRoom(window.currentUserId);
            if (response.success) {
                currentRoomId = response.roomId;
                isHost = true;
                lobbyMessage.textContent = `Sala criada! Compartilhe o código:`;
                roomCodeDisplay.textContent = currentRoomId;
                roomCodeDisplay.style.display = 'block';
                startOnlineGameButton.style.display = 'none'; // Só aparece quando tiver 2 jogadores
                leaveRoomButton.style.display = 'block';
                
                // Começa a ouvir as mudanças na sala
                unsubscribeFromRoom = window.listenToRoomChanges(currentRoomId, handleRoomUpdate);
            } else {
                lobbyMessage.textContent = `Erro ao criar sala: ${response.message}`;
            }
        }

        async function joinOnlineRoom() {
            if (!window.currentUserId) {
                lobbyMessage.textContent = "Erro: UID do usuário não disponível.";
                return;
            }
            const roomId = joinRoomInput.value.trim();
            if (!roomId) {
                lobbyMessage.textContent = "Por favor, digite um código de sala.";
                return;
            }
            lobbyMessage.textContent = "Entrando na sala...";
            const response = await window.joinFirestoreRoom(roomId, window.currentUserId);
            if (response.success) {
                currentRoomId = roomId;
                isHost = (response.roomData.hostId === window.currentUserId);
                lobbyMessage.textContent = `Entrou na sala!`;
                roomCodeDisplay.textContent = currentRoomId;
                roomCodeDisplay.style.display = 'block';
                startOnlineGameButton.style.display = 'none'; // O guest não inicia o jogo
                leaveRoomButton.style.display = 'block';

                // Começa a ouvir as mudanças na sala
                unsubscribeFromRoom = window.listenToRoomChanges(currentRoomId, handleRoomUpdate);
            } else {
                lobbyMessage.textContent = `Erro ao entrar na sala: ${response.message}`;
            }
        }

        function handleRoomUpdate(roomData) {
            if (!roomData) {
                // Sala foi excluída
                lobbyMessage.textContent = "A sala foi fechada pelo host.";
                roomCodeDisplay.style.display = 'none';
                startOnlineGameButton.style.display = 'none';
                leaveRoomButton.style.display = 'none';
                playerList.innerHTML = '';
                currentRoomId = null;
                isHost = false;
                if (unsubscribeFromRoom) {
                    unsubscribeFromRoom();
                    unsubscribeFromRoom = null;
                }
                // Se o jogo estava ativo, volta para o menu principal
                if (gameActive) {
                    cancelAnimationFrame(animationFrameId);
                    gameActive = false;
                    canvas.style.display = 'none';
                    uiDisplay.style.display = 'none';
                    mainMenu.style.display = 'flex';
                }
                return;
            }

            playerList.innerHTML = '';
            const hostLi = document.createElement('li');
            hostLi.textContent = `Host: ${roomData.hostId.substring(0, 5)}`;
            playerList.appendChild(hostLi);

            if (roomData.guestId) {
                const guestLi = document.createElement('li');
                guestLi.textContent = `Convidado: ${roomData.guestId.substring(0, 5)}`;
                playerList.appendChild(guestLi);
                if (isHost) {
                    startOnlineGameButton.style.display = 'block'; // Host pode iniciar quando há 2 jogadores
                }
            } else {
                startOnlineGameButton.style.display = 'none';
            }

            if (roomData.status === 'playing' && gameActive === false) {
                // Se o status da sala mudou para 'playing' e o jogo não está ativo, inicia o jogo online
                startGameOnline(roomData.gameState);
            } else if (roomData.status === 'playing' && gameActive === true) {
                // Se o jogo já está ativo, sincroniza o estado
                syncGameState(roomData.gameState);
            }
        }

        async function startGameOnline(initialGameState = null) {
            if (!window.currentUserId || !currentRoomId) {
                lobbyMessage.textContent = "Erro: Não foi possível iniciar o jogo online. Tente novamente.";
                return;
            }

            // O host atualiza o status da sala para 'playing'
            if (isHost) {
                await window.updateFirestoreGameState(currentRoomId, {
                    player1: { x: gameWidth * 0.25, y: gameHeight / 2, dx: 0, dy: 0 },
                    player2: { x: gameWidth * 0.75, y: gameHeight / 2, dx: 0, dy: 0 },
                    ball: { x: gameWidth / 2, y: gameHeight / 2, dx: 0, dy: 0 },
                    score1: 0,
                    score2: 0,
                });
                await window.firebaseDb.doc(`artifacts/${window.appId}/public/data/rooms/${currentRoomId}`).update({ status: 'playing' });
            }

            isOnlineGame = true;
            onlineLobbyModal.style.display = 'none';
            canvas.style.display = 'block';
            uiDisplay.style.display = 'flex';
            
            setupGame(); // Inicializa jogadores e bola localmente
            gameActive = true;
            showKickoffMessage(); // Mostra a mensagem de saída de bola no início do jogo online
            gameLoop(); // Inicia o loop de renderização

            // Se for o guest, o estado inicial virá do host
            if (!isHost && initialGameState) {
                syncGameState(initialGameState);
            }
        }

        function syncGameState(gameState) {
            if (!gameState) return;

            // Sincroniza a bola
            ball.x = gameState.ball.x;
            ball.y = gameState.ball.y;
            ball.dx = gameState.ball.dx;
            ball.dy = gameState.ball.dy;

            // Sincroniza jogadores
            if (isHost) {
                // Host controla player1, recebe input do player2
                player.x = gameState.player1.x;
                player.y = gameState.player1.y;
                player.dx = gameState.player1.dx;
                player.dy = gameState.player1.dy;

                aiPlayer.x = gameState.player2.x; // AI player é o player 2 no lado do host
                aiPlayer.y = gameState.player2.y;
                aiPlayer.dx = gameState.player2.dx;
                aiPlayer.dy = gameState.player2.dy;
            } else {
                // Guest controla player2, recebe input do player1
                player.x = gameState.player2.x; // Player é o player 2 no lado do guest
                player.y = gameState.player2.y;
                player.dx = gameState.player2.dx;
                player.dy = gameState.player2.dy;

                aiPlayer.x = gameState.player1.x; // AI player é o player 1 no lado do guest
                aiPlayer.y = gameState.player1.y;
                aiPlayer.dx = gameState.player1.dx;
                aiPlayer.dy = gameState.player1.dy;
            }

            // Sincroniza placar
            playerScore = gameState.score1;
            aiScore = gameState.score2;
            updateScoreDisplay();
        }

        async function leaveOnlineRoom() {
            if (unsubscribeFromRoom) {
                unsubscribeFromRoom();
                unsubscribeFromRoom = null;
            }
            if (isHost && currentRoomId) {
                await window.deleteFirestoreRoom(currentRoomId);
            }
            currentRoomId = null;
            isHost = false;
            isOnlineGame = false;
            
            // Volta para o menu principal
            cancelAnimationFrame(animationFrameId);
            gameActive = false;
            canvas.style.display = 'none';
            uiDisplay.style.display = 'none';
            mainMenu.style.display = 'flex';
            onlineLobbyModal.style.display = 'none';
        }

        // --- Loop Principal do Jogo ---
        function gameLoop() {
            if (!gameActive) return;

            // Se for um jogo online, apenas o host atualiza o estado e envia para o Firestore
            if (isOnlineGame && !isHost) {
                // Guests apenas renderizam o estado recebido
                // O input do guest é enviado para o host, que o processa
                // A lógica de update dos players e ball é pulada aqui para o guest
            } else {
                // Atualiza objetos (offline ou host online)
                player.update();
                aiPlayer.update(); // AI no offline, ou player 2 no online (controlado pelo guest)
                playerGoalie.update();
                aiGoalie.update();
                ball.update();

                // Decrementa o cooldown do chute
                if (kickCooldown > 0) {
                    kickCooldown--;
                }

                // Lógica de Chute do Jogador
                if (keys['Space']) { // Tecla de chute
                    player.kick(ball);
                }

                // Lógica de Chute da IA (apenas para offline, no online o player 2 é humano)
                if (!isOnlineGame) {
                    const distanceAItoBall = Math.sqrt(Math.pow(aiPlayer.x - ball.x, 2) + Math.pow(aiPlayer.y - ball.y, 2));
                    if (distanceAItoBall < aiPlayer.radius + ball.radius + 5 && Math.random() < 0.05) {
                        aiPlayer.kick(ball);
                    }
                }

                // Lógica de Colisão
                if (checkCollision(player, ball)) {
                    resolveCollision(player, ball);
                }
                if (checkCollision(aiPlayer, ball)) {
                    resolveCollision(aiPlayer, ball);
                }
                if (checkCollision(playerGoalie, ball)) {
                    resolveCollision(playerGoalie, ball);
                }
                if (checkCollision(aiGoalie, ball)) {
                    resolveCollision(aiGoalie, ball);
                }

                // Verifica Gols
                checkGoal();

                // Se for online e host, envia o estado atualizado para o Firestore
                if (isOnlineGame && isHost) {
                    window.updateFirestoreGameState(currentRoomId, {
                        player1: { x: player.x, y: player.y, dx: player.dx, dy: player.dy },
                        player2: { x: aiPlayer.x, y: aiPlayer.y, dx: aiPlayer.dx, dy: aiPlayer.dy }, // aiPlayer é o player 2
                        ball: { x: ball.x, y: ball.y, dx: ball.dx, dy: ball.dy },
                        score1: playerScore,
                        score2: aiScore,
                    });
                }
            }

            // Desenha tudo
            ctx.clearRect(0, 0, gameWidth, gameHeight); // Limpa o canvas
            drawField();
            player.draw();
            aiPlayer.draw();
            playerGoalie.draw(); // Desenha o goleiro do jogador
            aiGoalie.draw(); // Desenha o goleiro da IA
            ball.draw();

            animationFrameId = requestAnimationFrame(gameLoop);
        }

        // --- Event Listeners ---
        window.addEventListener('resize', () => {
            canvas.width = canvas.offsetWidth;
            canvas.height = canvas.offsetHeight;
            if (gameActive) {
                setupGame();
            }
        });

        document.addEventListener('keydown', (e) => {
            keys[e.code] = true;
        });

        document.addEventListener('keyup', (e) => {
            keys[e.code] = false;
        });

        // Botões do Menu Principal
        restartButton.addEventListener('click', restartGame);
        playOfflineButton.addEventListener('click', startGameOffline);
        playOnlineButton.addEventListener('click', showOnlineLobby); // Abre o lobby online
        createAccountButton.addEventListener('click', () => showAccountModal('create'));
        loginButton.addEventListener('click', () => showAccountModal('login'));

        // Botões do Modal de Conta
        submitAccountButton.addEventListener('click', () => {
            if (accountModalTitle.textContent === 'Criar Conta') {
                window.firebaseCreateUser(emailInput.value, passwordInput.value, usernameInput.value).then(res => {
                    accountMessage.textContent = res.message;
                    accountMessage.style.color = res.success ? 'green' : 'red';
                    if (res.success) {
                        setTimeout(() => {
                            accountModal.style.display = 'none';
                            mainMenu.style.display = 'flex';
                            updateScoreDisplay();
                        }, 1500);
                    }
                });
            } else if (accountModalTitle.textContent === 'Fazer Login') {
                window.firebaseLoginUser(emailInput.value, passwordInput.value).then(res => {
                    accountMessage.textContent = res.message;
                    accountMessage.style.color = res.success ? 'green' : 'red';
                    if (res.success) {
                        setTimeout(() => {
                            accountModal.style.display = 'none';
                            mainMenu.style.display = 'flex';
                            updateScoreDisplay();
                        }, 1500);
                    }
                });
            }
        });
        cancelAccountButton.addEventListener('click', () => {
            accountModal.style.display = 'none';
            mainMenu.style.display = 'flex';
            onlineMessage.style.display = 'none'; // Garante que a mensagem online esteja oculta
            messageBox.style.display = 'none'; // Garante que a caixa de mensagem esteja oculta
            kickoffMessage.style.display = 'none'; // Garante que a mensagem de saída de bola esteja oculta
        });

        // Botões do Lobby Online
        createRoomButton.addEventListener('click', createOnlineRoom);
        joinRoomButton.addEventListener('click', joinOnlineRoom);
        startOnlineGameButton.addEventListener('click', () => startGameOnline());
        leaveRoomButton.addEventListener('click', leaveOnlineRoom);
        cancelLobbyButton.addEventListener('click', () => {
            onlineLobbyModal.style.display = 'none';
            mainMenu.style.display = 'flex';
            onlineMessage.style.display = 'none';
            messageBox.style.display = 'none'; // Garante que a caixa de mensagem esteja oculta
            kickoffMessage.style.display = 'none'; // Garante que a mensagem de saída de bola esteja oculta
            if (unsubscribeFromRoom) { // Garante que o listener seja desativado ao sair do lobby
                unsubscribeFromRoom();
                unsubscribeFromRoom = null;
            }
            if (isHost && currentRoomId) { // Se o host sair, tenta deletar a sala
                window.deleteFirestoreRoom(currentRoomId);
            }
            currentRoomId = null;
            isHost = false;
        });


        // Inicializa o jogo no carregamento da janela
        window.addEventListener('load', () => {
            canvas.width = 800; // Tamanho padrão inicial
            canvas.height = 450; // Tamanho padrão inicial (16:9)

            uiDisplay.style.display = 'none'; // Esconde a UI do placar inicialmente
            mainMenu.style.display = 'flex'; // Mostra o menu principal
            messageBox.style.display = 'none'; // Garante que a caixa de mensagem esteja oculta no carregamento
            accountModal.style.display = 'none'; // Garante que o modal de conta esteja oculto
            onlineLobbyModal.style.display = 'none'; // Garante que o lobby online esteja oculto
            kickoffMessage.style.display = 'none'; // Garante que a mensagem de saída de bola esteja oculta no carregamento
        });
    </script>
</body>
</html>
