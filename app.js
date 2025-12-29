// PeerCall - WebRTC Video Calling Application
// Using Peer.js for peer-to-peer connections

// Global variables
let peer = null;
let currentCall = null;
let localStream = null;
let remoteStream = null;
let callStartTime = null;
let callTimerInterval = null;
let isAudioEnabled = true;
let isVideoEnabled = true;

// DOM Elements
const loginScreen = document.getElementById('loginScreen');
const callScreen = document.getElementById('callScreen');
const emailInput = document.getElementById('emailInput');
const loginBtn = document.getElementById('loginBtn');
const userEmailDisplay = document.getElementById('userEmailDisplay');
const connectionStatus = document.getElementById('connectionStatus');
const friendEmail = document.getElementById('friendEmail');
const callVoiceBtn = document.getElementById('callVoiceBtn');
const callVideoBtn = document.getElementById('callVideoBtn');
const voiceCallBtn = document.getElementById('voiceCallBtn');
const videoCallBtn = document.getElementById('videoCallBtn');
const hangupBtn = document.getElementById('hangupBtn');
const logoutBtn = document.getElementById('logoutBtn');
const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');
const toggleVideo = document.getElementById('toggleVideo');
const toggleAudio = document.getElementById('toggleAudio');
const micStatus = document.getElementById('micStatus');
const camStatus = document.getElementById('camStatus');
const micText = document.getElementById('micText');
const camText = document.getElementById('camText');
const callStatus = document.getElementById('callStatus');
const remotePeerInfo = document.getElementById('remotePeerInfo');
const callTimer = document.getElementById('callTimer');
const incomingCallModal = document.getElementById('incomingCallModal');
const callerEmail = document.getElementById('callerEmail');
const callType = document.getElementById('callType');
const acceptCallBtn = document.getElementById('acceptCallBtn');
const rejectCallBtn = document.getElementById('rejectCallBtn');
const alertModal = document.getElementById('alertModal');
const alertTitle = document.getElementById('alertTitle');
const alertMessage = document.getElementById('alertMessage');
const alertOkBtn = document.getElementById('alertOkBtn');
const recentContacts = document.getElementById('recentContacts');

// Email validation regex
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Initialize application
document.addEventListener('DOMContentLoaded', initApp);

function initApp() {
    // Check if user is already logged in
    const savedEmail = localStorage.getItem('peerCallUserEmail');
    if (savedEmail && emailRegex.test(savedEmail)) {
        initializePeer(savedEmail);
        showCallScreen(savedEmail);
    } else {
        loginScreen.classList.remove('hidden');
    }

    // Event Listeners
    loginBtn.addEventListener('click', handleLogin);
    emailInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleLogin();
    });
    
    callVoiceBtn.addEventListener('click', () => initiateCall('audio'));
    callVideoBtn.addEventListener('click', () => initiateCall('video'));
    voiceCallBtn.addEventListener('click', () => initiateCall('audio'));
    videoCallBtn.addEventListener('click', () => initiateCall('video'));
    hangupBtn.addEventListener('click', endCall);
    logoutBtn.addEventListener('click', handleLogout);
    toggleVideo.addEventListener('click', toggleCamera);
    toggleAudio.addEventListener('click', toggleMicrophone);
    acceptCallBtn.addEventListener('click', acceptIncomingCall);
    rejectCallBtn.addEventListener('click', rejectIncomingCall);
    alertOkBtn.addEventListener('click', () => alertModal.classList.add('hidden'));
    
    friendEmail.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') initiateCall('video');
    });
    
    // Load recent contacts
    loadRecentContacts();
}

// Handle user login
function handleLogin() {
    const email = emailInput.value.trim();
    
    if (!email) {
        showAlert('Email Required', 'Please enter your email address');
        return;
    }
    
    if (!emailRegex.test(email)) {
        showAlert('Invalid Email', 'Please enter a valid email address');
        return;
    }
    
    // Check if peer with this ID already exists (simplified check)
    if (localStorage.getItem('peerCallUserEmail') === email) {
        showAlert('Already Logged In', 'You are already logged in with this email on this device.');
    }
    
    // Save email to localStorage
    localStorage.setItem('peerCallUserEmail', email);
    
    // Initialize Peer.js with this email as ID
    initializePeer(email);
    
    // Show call screen
    showCallScreen(email);
}

// Initialize Peer.js connection
function initializePeer(email) {
    try {
        // Create new Peer instance with the email as ID
        peer = new Peer(email, {
            host: '0.peerjs.com',
            port: 443,
            path: '/',
            secure: true,
            debug: 2
        });
        
        // Peer connection opened
        peer.on('open', (id) => {
            console.log('Peer connected with ID:', id);
            updateConnectionStatus('connected', 'Connected to Peer Server');
            userEmailDisplay.textContent = id;
            updateCallStatus('Ready to make calls');
            
            // Initialize local media
            initializeLocalMedia();
        });
        
        // Incoming call
        peer.on('call', (call) => {
            console.log('Incoming call from:', call.peer);
            handleIncomingCall(call);
        });
        
        // Handle errors
        peer.on('error', (err) => {
            console.error('Peer error:', err);
            
            let errorMessage = 'Connection error';
            if (err.type === 'unavailable-id') {
                errorMessage = 'This email is already in use. Please use a different email.';
            } else if (err.type === 'network') {
                errorMessage = 'Network error. Please check your connection.';
            } else if (err.type === 'peer-unavailable') {
                errorMessage = 'The peer you\'re trying to reach is unavailable.';
            }
            
            updateConnectionStatus('error', errorMessage);
            showAlert('Connection Error', errorMessage);
        });
        
        // Handle disconnection
        peer.on('disconnected', () => {
            console.log('Peer disconnected');
            updateConnectionStatus('disconnected', 'Disconnected from server');
            
            // Try to reconnect
            setTimeout(() => {
                if (peer && peer.disconnected) {
                    peer.reconnect();
                }
            }, 5000);
        });
        
    } catch (error) {
        console.error('Failed to initialize Peer:', error);
        showAlert('Initialization Error', 'Failed to initialize Peer.js. Please refresh the page.');
    }
}

// Initialize local camera and microphone
async function initializeLocalMedia() {
    try {
        // Request audio and video permissions
        localStream = await navigator.mediaDevices.getUserMedia({
            video: {
                width: { ideal: 640 },
                height: { ideal: 480 },
                frameRate: { ideal: 24 }
            },
            audio: {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true
            }
        });
        
        // Set local video stream
        localVideo.srcObject = localStream;
        
        updateMediaStatus();
        console.log('Local media initialized');
        
    } catch (error) {
        console.error('Error accessing media devices:', error);
        
        let errorMessage = 'Could not access camera/microphone. ';
        if (error.name === 'NotAllowedError') {
            errorMessage += 'Please allow camera and microphone permissions.';
        } else if (error.name === 'NotFoundError') {
            errorMessage += 'No camera/microphone found.';
        } else if (error.name === 'NotReadableError') {
            errorMessage += 'Camera/microphone is already in use.';
        }
        
        showAlert('Media Error', errorMessage);
    }
}

// Show call screen after login
function showCallScreen(email) {
    loginScreen.classList.add('hidden');
    callScreen.classList.remove('hidden');
    userEmailDisplay.textContent = email;
    updateCallStatus('Ready to make calls');
}

// Update connection status display
function updateConnectionStatus(status, message = '') {
    const statusDot = connectionStatus.querySelector('.w-3');
    const statusText = connectionStatus.querySelector('span:nth-child(2)');
    
    switch (status) {
        case 'connected':
            statusDot.className = 'w-3 h-3 rounded-full bg-green-500 mr-2';
            statusText.textContent = 'Connected' + (message ? `: ${message}` : '');
            break;
        case 'connecting':
            statusDot.className = 'w-3 h-3 rounded-full bg-yellow-500 mr-2 animate-pulse';
            statusText.textContent = 'Connecting...';
            break;
        case 'disconnected':
            statusDot.className = 'w-3 h-3 rounded-full bg-red-500 mr-2';
            statusText.textContent = 'Disconnected' + (message ? `: ${message}` : '');
            break;
        case 'error':
            statusDot.className = 'w-3 h-3 rounded-full bg-red-500 mr-2';
            statusText.textContent = 'Error' + (message ? `: ${message}` : '');
            break;
        case 'in-call':
            statusDot.className = 'w-3 h-3 rounded-full bg-blue-500 mr-2';
            statusText.textContent = 'In Call' + (message ? `: ${message}` : '');
            break;
    }
}

// Update call status display
function updateCallStatus(message, isError = false) {
    callStatus.textContent = message;
    callStatus.className = isError ? 'text-red-400' : 'text-gray-400';
}

// Initiate a call to a friend
async function initiateCall(callType) {
    const friendEmailValue = friendEmail.value.trim();
    
    if (!friendEmailValue) {
        showAlert('Email Required', 'Please enter your friend\'s email address');
        return;
    }
    
    if (!emailRegex.test(friendEmailValue)) {
        showAlert('Invalid Email', 'Please enter a valid email address');
        return;
    }
    
    if (friendEmailValue === peer.id) {
        showAlert('Cannot Call Yourself', 'You cannot call yourself. Enter a different email.');
        return;
    }
    
    if (!localStream) {
        await initializeLocalMedia();
    }
    
    if (!localStream) {
        showAlert('Media Required', 'Camera/microphone access is required to make calls');
        return;
    }
    
    // Update UI
    updateCallStatus(`Calling ${friendEmailValue}...`);
    updateConnectionStatus('connecting', `Calling ${friendEmailValue}`);
    
    try {
        // Determine media constraints based on call type
        const constraints = callType === 'video' 
            ? { video: true, audio: true }
            : { video: false, audio: true };
        
        // Create the call
        currentCall = peer.call(friendEmailValue, localStream, {
            metadata: {
                type: callType,
                caller: peer.id
            }
        });
        
        if (!currentCall) {
            throw new Error('Failed to create call');
        }
        
        // Handle call events
        setupCallEventHandlers(currentCall);
        
        // Show hangup button
        hangupBtn.classList.remove('hidden');
        
        // Save to recent contacts
        addToRecentContacts(friendEmailValue);
        
    } catch (error) {
        console.error('Error initiating call:', error);
        updateCallStatus('Failed to initiate call', true);
        showAlert('Call Failed', `Could not call ${friendEmailValue}. They might be offline or have a different Peer ID.`);
    }
}

// Set up event handlers for a call
function setupCallEventHandlers(call) {
    call.on('stream', (remoteStream) => {
        console.log('Received remote stream');
        handleRemoteStream(remoteStream);
        
        // Update UI for active call
        remotePeerInfo.textContent = call.peer;
        updateCallStatus('Call connected');
        updateConnectionStatus('in-call', `Connected to ${call.peer}`);
        
        // Start call timer
        startCallTimer();
    });
    
    call.on('close', () => {
        console.log('Call closed');
        endCall();
    });
    
    call.on('error', (err) => {
        console.error('Call error:', err);
        updateCallStatus('Call error occurred', true);
        endCall();
    });
}

// Handle incoming call
function handleIncomingCall(call) {
    // Show incoming call modal
    callerEmail.textContent = call.metadata?.caller || call.peer;
    callType.textContent = call.metadata?.type === 'video' ? 'Video Call' : 'Voice Call';
    
    incomingCallModal.classList.remove('hidden');
    
    // Store the call for later use
    currentCall = call;
    
    // Set up event handlers for accept/reject
    acceptCallBtn.onclick = () => acceptIncomingCall(call);
    rejectCallBtn.onclick = () => rejectIncomingCall(call);
    
    // Auto-reject after 30 seconds
    setTimeout(() => {
        if (incomingCallModal.classList.contains('hidden') === false) {
            rejectIncomingCall(call);
            showAlert('Call Missed', `Missed call from ${call.peer}`);
        }
    }, 30000);
}

// Accept incoming call
async function acceptIncomingCall(call) {
    if (!localStream) {
        await initializeLocalMedia();
    }
    
    if (!localStream) {
        showAlert('Media Required', 'Camera/microphone access is required to accept calls');
        incomingCallModal.classList.add('hidden');
        return;
    }
    
    incomingCallModal.classList.add('hidden');
    updateCallStatus(`Connecting to ${call.peer}...`);
    
    try {
        // Answer the call with local stream
        call.answer(localStream);
        
        // Set up call event handlers
        setupCallEventHandlers(call);
        
        // Show hangup button
        hangupBtn.classList.remove('hidden');
        
        // Add to recent contacts
        addToRecentContacts(call.peer);
        
    } catch (error) {
        console.error('Error answering call:', error);
        updateCallStatus('Failed to answer call', true);
        showAlert('Call Failed', 'Could not answer the call');
    }
}

// Reject incoming call
function rejectIncomingCall(call) {
    incomingCallModal.classList.add('hidden');
    
    if (call) {
        call.close();
    }
    
    updateCallStatus('Call rejected');
    currentCall = null;
}

// Handle remote stream
function handleRemoteStream(stream) {
    remoteStream = stream;
    remoteVideo.srcObject = stream;
    
    // Play the remote video
    remoteVideo.play().catch(e => console.error('Error playing remote video:', e));
}

// End current call
function endCall() {
    // Stop call timer
    stopCallTimer();
    
    // Close the call if it exists
    if (currentCall) {
        currentCall.close();
        currentCall = null;
    }
    
    // Clear remote video
    if (remoteVideo.srcObject) {
        remoteVideo.srcObject.getTracks().forEach(track => track.stop());
        remoteVideo.srcObject = null;
    }
    
    // Reset remote stream
    remoteStream = null;
    
    // Update UI
    remotePeerInfo.textContent = 'Not connected';
    updateCallStatus('Call ended');
    updateConnectionStatus('connected', 'Ready for calls');
    hangupBtn.classList.add('hidden');
    callTimer.classList.add('hidden');
    
    // Reset call status after a delay
    setTimeout(() => {
        if (!currentCall) {
            updateCallStatus('Ready to make calls');
        }
    }, 3000);
}

// Toggle camera on/off
function toggleCamera() {
    if (!localStream) return;
    
    const videoTrack = localStream.getVideoTracks()[0];
    if (videoTrack) {
        isVideoEnabled = !videoTrack.enabled;
        videoTrack.enabled = isVideoEnabled;
        
        // Update UI
        const icon = toggleVideo.querySelector('i');
        if (isVideoEnabled) {
            icon.className = 'fas fa-video text-xl';
            toggleVideo.classList.remove('bg-red-700');
            toggleVideo.classList.add('bg-gray-700');
        } else {
            icon.className = 'fas fa-video-slash text-xl';
            toggleVideo.classList.remove('bg-gray-700');
            toggleVideo.classList.add('bg-red-700');
        }
        
        updateMediaStatus();
    }
}

// Toggle microphone on/off
function toggleMicrophone() {
    if (!localStream) return;
    
    const audioTrack = localStream.getAudioTracks()[0];
    if (audioTrack) {
        isAudioEnabled = !audioTrack.enabled;
        audioTrack.enabled = isAudioEnabled;
        
        // Update UI
        const icon = toggleAudio.querySelector('i');
        if (isAudioEnabled) {
            icon.className = 'fas fa-microphone text-xl';
            toggleAudio.classList.remove('bg-red-700');
            toggleAudio.classList.add('bg-gray-700');
        } else {
            icon.className = 'fas fa-microphone-slash text-xl';
            toggleAudio.classList.remove('bg-gray-700');
            toggleAudio.classList.add('bg-red-700');
        }
        
        updateMediaStatus();
    }
}

// Update media status indicators
function updateMediaStatus() {
    if (!localStream) return;
    
    const audioTrack = localStream.getAudioTracks()[0];
    const videoTrack = localStream.getVideoTracks()[0];
    
    isAudioEnabled = audioTrack ? audioTrack.enabled : false;
    isVideoEnabled = videoTrack ? videoTrack.enabled : false;
    
    // Update status indicators
    micStatus.className = `w-3 h-3 rounded-full mr-3 ${isAudioEnabled ? 'bg-green-500' : 'bg-red-500'}`;
    camStatus.className = `w-3 h-3 rounded-full mr-3 ${isVideoEnabled ? 'bg-green-500' : 'bg-red-500'}`;
    
    micText.textContent = isAudioEnabled ? 'On' : 'Off';
    camText.textContent = isVideoEnabled ? 'On' : 'Off';
}

// Start call timer
function startCallTimer() {
    callStartTime = new Date();
    callTimer.classList.remove('hidden');
    
    callTimerInterval = setInterval(() => {
        const now = new Date();
        const diff = Math.floor((now - callStartTime) / 1000);
        
        const minutes = Math.floor(diff / 60).toString().padStart(2, '0');
        const seconds = (diff % 60).toString().padStart(2, '0');
        
        callTimer.textContent = `${minutes}:${seconds}`;
    }, 1000);
}

// Stop call timer
function stopCallTimer() {
    if (callTimerInterval) {
        clearInterval(callTimerInterval);
        callTimerInterval = null;
    }
    callStartTime = null;
}

// Show alert modal
function showAlert(title, message) {
    alertTitle.textContent = title;
    alertMessage.textContent = message;
    alertModal.classList.remove('hidden');
}

// Handle logout
function handleLogout() {
    // End any active call
    if (currentCall) {
        endCall();
    }
    
    // Close peer connection
    if (peer) {
        peer.destroy();
        peer = null;
    }
    
    // Stop local media
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
        localStream = null;
    }
    
    // Clear localStorage
    localStorage.removeItem('peerCallUserEmail');
    
    // Reset UI
    callScreen.classList.add('hidden');
    loginScreen.classList.remove('hidden');
    emailInput.value = '';
    emailInput.focus();
}

// Add email to recent contacts
function addToRecentContacts(email) {
    if (!email || email === peer.id) return;
    
    let contacts = JSON.parse(localStorage.getItem('peerCallRecentContacts') || '[]');
    
    // Remove if already exists
    contacts = contacts.filter(contact => contact !== email);
    
    // Add to beginning
    contacts.unshift(email);
    
    // Keep only last 5 contacts
    contacts = contacts.slice(0, 5);
    
    // Save to localStorage
    localStorage.setItem('peerCallRecentContacts', JSON.stringify(contacts));
    
    // Update UI
    loadRecentContacts();
}

// Load recent contacts from localStorage
function loadRecentContacts() {
    const contacts = JSON.parse(localStorage.getItem('peerCallRecentContacts') || '[]');
    
    if (contacts.length === 0) {
        recentContacts.innerHTML = '<p class="text-gray-400 text-sm">No recent calls</p>';
        return;
    }
    
    let html = '';
    contacts.forEach(email => {
        html += `
            <div class="flex items-center justify-between p-3 bg-gray-700 rounded-lg hover:bg-gray-600 transition cursor-pointer" 
                 onclick="document.getElementById('friendEmail').value = '${email}'; document.getElementById('friendEmail').focus()">
                <div class="flex items-center">
                    <div class="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center mr-3">
                        <i class="fas fa-user text-sm"></i>
                    </div>
                    <span class="truncate">${email}</span>
                </div>
                <i class="fas fa-phone text-gray-400"></i>
            </div>
        `;
    });
    
    recentContacts.innerHTML = html;
}