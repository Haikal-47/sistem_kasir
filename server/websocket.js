import { WebSocketServer, WebSocket } from 'ws';

// Stores active sessions: sessionId -> { terminalWs, scannerWsList: Set() }
const sessions = new Map();

export const setupWebSocketServer = (httpServer) => {
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });

  wss.on('connection', (ws, req) => {
    let currentSession = null;
    let clientRole = null; // 'TERMINAL' or 'SCANNER'

    ws.on('message', (messageBuffer) => {
      try {
        const data = JSON.parse(messageBuffer.toString());

        switch (data.type) {
          // Laptop POS registers as terminal for this session
          case 'JOIN_TERMINAL': {
            currentSession = data.session || 'DEFAULT';
            clientRole = 'TERMINAL';

            if (!sessions.has(currentSession)) {
              sessions.set(currentSession, { terminalWs: ws, scanners: new Set() });
            } else {
              sessions.get(currentSession).terminalWs = ws;
            }

            ws.send(JSON.stringify({ 
              type: 'TERMINAL_REGISTERED', 
              session: currentSession,
              activeScanners: sessions.get(currentSession).scanners.size
            }));
            break;
          }

          // Mobile phone scanner connects to this session
          case 'JOIN_SCANNER': {
            currentSession = data.session || 'DEFAULT';
            clientRole = 'SCANNER';
            const deviceName = data.deviceName || 'Smartphone Kasir';

            if (!sessions.has(currentSession)) {
              sessions.set(currentSession, { terminalWs: null, scanners: new Set() });
            }

            const sessionData = sessions.get(currentSession);
            sessionData.scanners.add(ws);

            // Acknowledge phone
            ws.send(JSON.stringify({ 
              type: 'SCANNER_REGISTERED', 
              session: currentSession,
              terminalConnected: !!sessionData.terminalWs && sessionData.terminalWs.readyState === WebSocket.OPEN
            }));

            // Notify laptop POS terminal that a scanner joined
            if (sessionData.terminalWs && sessionData.terminalWs.readyState === WebSocket.OPEN) {
              sessionData.terminalWs.send(JSON.stringify({
                type: 'SCANNER_CONNECTED',
                deviceName,
                activeScanners: sessionData.scanners.size
              }));
            }
            break;
          }

          // Mobile phone sends scanned barcode to laptop POS
          case 'BARCODE_SCANNED': {
            const session = data.session || currentSession;
            const barcode = data.barcode;

            if (!session || !barcode) return;

            const sessionData = sessions.get(session);
            if (sessionData && sessionData.terminalWs && sessionData.terminalWs.readyState === WebSocket.OPEN) {
              // Forward immediately to laptop POS
              sessionData.terminalWs.send(JSON.stringify({
                type: 'BARCODE_RECEIVED',
                barcode,
                timestamp: new Date().toISOString()
              }));
            }
            break;
          }

          // Laptop POS confirms product lookup and sends result back to phone
          case 'SCAN_CONFIRMED': {
            const session = data.session || currentSession;
            const sessionData = sessions.get(session);
            if (sessionData && sessionData.scanners) {
              const payload = JSON.stringify({
                type: 'SCAN_ACK',
                barcode: data.barcode,
                productName: data.productName,
                price: data.price,
                success: data.success,
                message: data.message
              });
              sessionData.scanners.forEach((scannerWs) => {
                if (scannerWs.readyState === WebSocket.OPEN) {
                  scannerWs.send(payload);
                }
              });
            }
            break;
          }

          case 'PING': {
            ws.send(JSON.stringify({ type: 'PONG' }));
            break;
          }
        }
      } catch (err) {
        console.error('Error handling WebSocket message:', err);
      }
    });

    ws.on('close', () => {
      if (currentSession && sessions.has(currentSession)) {
        const sessionData = sessions.get(currentSession);
        if (clientRole === 'TERMINAL') {
          sessionData.terminalWs = null;
        } else if (clientRole === 'SCANNER') {
          sessionData.scanners.delete(ws);
          if (sessionData.terminalWs && sessionData.terminalWs.readyState === WebSocket.OPEN) {
            sessionData.terminalWs.send(JSON.stringify({
              type: 'SCANNER_DISCONNECTED',
              activeScanners: sessionData.scanners.size
            }));
          }
        }

        if (!sessionData.terminalWs && sessionData.scanners.size === 0) {
          sessions.delete(currentSession);
        }
      }
    });
  });

  console.log('📡 Real-time WebSocket Scanner Server active at /ws');
  return wss;
};
