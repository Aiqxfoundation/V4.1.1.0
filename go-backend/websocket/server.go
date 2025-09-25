package websocket

import (
        "encoding/json"
        "log"
        "net/http"
        "sync"
        "time"

        "github.com/gorilla/websocket"
        "github.com/shopspring/decimal"
)

var upgrader = websocket.Upgrader{
        CheckOrigin: func(r *http.Request) bool {
                return true // Allow connections from any origin for development
        },
        ReadBufferSize:  1024,
        WriteBufferSize: 1024,
}

type Hub struct {
        clients    map[*Client]bool
        broadcast  chan []byte
        register   chan *Client
        unregister chan *Client
        mu         sync.RWMutex
}

type Client struct {
        hub      *Hub
        conn     *websocket.Conn
        send     chan []byte
        userID   string
        username string
}

type Message struct {
        Type      string          `json:"type"`
        Timestamp time.Time       `json:"timestamp"`
        Data      json.RawMessage `json:"data"`
}

type BlockUpdate struct {
        BlockHeight      int64           `json:"blockHeight"`
        TotalReward      decimal.Decimal `json:"totalReward"`
        TotalHashPower   decimal.Decimal `json:"totalHashPower"`
        ActiveMiners     int             `json:"activeMiners"`
        NextBlockTime    time.Time       `json:"nextBlockTime"`
        GlobalHashrate   decimal.Decimal `json:"globalHashrate"`
}

type UserMiningUpdate struct {
        UserID               string          `json:"userId"`
        PersonalBlockHeight  int             `json:"personalBlockHeight"`
        UnclaimedRewards     decimal.Decimal `json:"unclaimedRewards"`
        HashPower            decimal.Decimal `json:"hashPower"`
        BlocksParticipated   int             `json:"blocksParticipated"`
        LastReward           decimal.Decimal `json:"lastReward"`
        MiningActive         bool            `json:"miningActive"`
        BlocksUntilSuspension int            `json:"blocksUntilSuspension"`
        UnclaimedBlocksCount int             `json:"unclaimedBlocksCount"`
        MiningSuspended      bool            `json:"miningSuspended"`
}

var GlobalHub *Hub

func NewHub() *Hub {
        return &Hub{
                broadcast:  make(chan []byte, 256),
                register:   make(chan *Client),
                unregister: make(chan *Client),
                clients:    make(map[*Client]bool),
        }
}

func (h *Hub) Run() {
        for {
                select {
                case client := <-h.register:
                        h.mu.Lock()
                        h.clients[client] = true
                        h.mu.Unlock()
                        log.Printf("Client connected: %s (Total: %d)", client.userID, len(h.clients))
                        
                        // Send initial mining status to newly connected client
                        go h.SendUserMiningStatus(client)

                case client := <-h.unregister:
                        h.mu.Lock()
                        if _, ok := h.clients[client]; ok {
                                delete(h.clients, client)
                                close(client.send)
                                h.mu.Unlock()
                                log.Printf("Client disconnected: %s (Total: %d)", client.userID, len(h.clients))
                        } else {
                                h.mu.Unlock()
                        }

                case message := <-h.broadcast:
                        h.mu.RLock()
                        for client := range h.clients {
                                select {
                                case client.send <- message:
                                default:
                                        // Client's send channel is full, close it
                                        close(client.send)
                                        delete(h.clients, client)
                                }
                        }
                        h.mu.RUnlock()
                }
        }
}

func (h *Hub) SendUserMiningStatus(client *Client) {
        // Send initial mining status when a user connects
        if client.userID == "" {
                return
        }
        
        // For initial connection, send a basic status update
        // The actual values will be fetched from the database via the mining calculator
        update := UserMiningUpdate{
                UserID:              client.userID,
                PersonalBlockHeight: 0,
                UnclaimedRewards:    decimal.Zero,
                HashPower:           decimal.Zero,
                BlocksParticipated:  0,
                LastReward:          decimal.Zero,
                MiningActive:        false,
                BlocksUntilSuspension: 24,
                UnclaimedBlocksCount: 0,
                MiningSuspended:     false,
        }
        
        // Send the update to this specific client
        data, err := json.Marshal(update)
        if err != nil {
                log.Printf("Error marshaling user mining status: %v", err)
                return
        }
        
        msg := Message{
                Type:      "user_mining_update",
                Timestamp: time.Now(),
                Data:      data,
        }
        
        msgBytes, err := json.Marshal(msg)
        if err != nil {
                log.Printf("Error marshaling message: %v", err)
                return
        }
        
        select {
        case client.send <- msgBytes:
                log.Printf("Sent initial mining status to user %s", client.userID)
        default:
                // Client buffer is full
                log.Printf("Failed to send initial status to user %s: buffer full", client.userID)
        }
}

func (h *Hub) BroadcastBlockUpdate(update BlockUpdate) {
        data, err := json.Marshal(update)
        if err != nil {
                log.Printf("Error marshaling block update: %v", err)
                return
        }

        msg := Message{
                Type:      "block_update",
                Timestamp: time.Now(),
                Data:      data,
        }

        msgBytes, err := json.Marshal(msg)
        if err != nil {
                log.Printf("Error marshaling message: %v", err)
                return
        }

        h.broadcast <- msgBytes
        log.Printf("Broadcasting block update: Block %d, Reward: %s, Active miners: %d", 
                update.BlockHeight, update.TotalReward.String(), update.ActiveMiners)
}

func (h *Hub) SendUserUpdate(userID string, update UserMiningUpdate) {
        data, err := json.Marshal(update)
        if err != nil {
                log.Printf("Error marshaling user update: %v", err)
                return
        }

        msg := Message{
                Type:      "user_mining_update",
                Timestamp: time.Now(),
                Data:      data,
        }

        msgBytes, err := json.Marshal(msg)
        if err != nil {
                log.Printf("Error marshaling message: %v", err)
                return
        }

        // Send to specific user
        h.mu.RLock()
        for client := range h.clients {
                if client.userID == userID {
                        select {
                        case client.send <- msgBytes:
                        default:
                                // Client buffer is full
                        }
                }
        }
        h.mu.RUnlock()
}

func (h *Hub) GetActiveMinersCount() int {
        h.mu.RLock()
        defer h.mu.RUnlock()
        return len(h.clients)
}

func (c *Client) ReadPump() {
        defer func() {
                c.hub.unregister <- c
                c.conn.Close()
        }()

        c.conn.SetReadDeadline(time.Now().Add(60 * time.Second))
        c.conn.SetPongHandler(func(string) error {
                c.conn.SetReadDeadline(time.Now().Add(60 * time.Second))
                return nil
        })

        for {
                _, message, err := c.conn.ReadMessage()
                if err != nil {
                        if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
                                log.Printf("websocket error: %v", err)
                        }
                        break
                }

                // Handle incoming messages from client
                var msg map[string]interface{}
                if err := json.Unmarshal(message, &msg); err != nil {
                        continue
                }

                // Handle different message types
                switch msg["type"] {
                case "ping":
                        // Respond with pong
                        pong := map[string]string{"type": "pong"}
                        if pongBytes, err := json.Marshal(pong); err == nil {
                                c.send <- pongBytes
                        }
                case "request_status":
                        // Send current mining status
                        go c.hub.SendUserMiningStatus(c)
                }
        }
}

func (c *Client) WritePump() {
        ticker := time.NewTicker(54 * time.Second)
        defer func() {
                ticker.Stop()
                c.conn.Close()
        }()

        for {
                select {
                case message, ok := <-c.send:
                        c.conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
                        if !ok {
                                c.conn.WriteMessage(websocket.CloseMessage, []byte{})
                                return
                        }

                        w, err := c.conn.NextWriter(websocket.TextMessage)
                        if err != nil {
                                return
                        }
                        w.Write(message)

                        // Add queued messages to current websocket message
                        n := len(c.send)
                        for i := 0; i < n; i++ {
                                w.Write([]byte{'\n'})
                                w.Write(<-c.send)
                        }

                        if err := w.Close(); err != nil {
                                return
                        }

                case <-ticker.C:
                        c.conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
                        if err := c.conn.WriteMessage(websocket.PingMessage, nil); err != nil {
                                return
                        }
                }
        }
}

func ServeWS(hub *Hub, w http.ResponseWriter, r *http.Request, userID, username string) {
        conn, err := upgrader.Upgrade(w, r, nil)
        if err != nil {
                log.Printf("Failed to upgrade connection: %v", err)
                return
        }

        client := &Client{
                hub:      hub,
                conn:     conn,
                send:     make(chan []byte, 256),
                userID:   userID,
                username: username,
        }

        client.hub.register <- client

        // Start goroutines for reading and writing
        go client.WritePump()
        go client.ReadPump()
}

func InitWebSocket() {
        GlobalHub = NewHub()
        go GlobalHub.Run()
        log.Println("WebSocket hub initialized and running")
}