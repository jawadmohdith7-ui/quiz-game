//ARXIU QUE GESTIONA LA CONNEXIÓ WEBSOCKET NATIVA DEL CLIENT

//=====================
//IMPORTEM
//=====================
using System;
using System.Collections.Concurrent;
using System.IO;
using System.Net.WebSockets;
using System.Text;
using System.Threading;
using System.Threading.Tasks;

//=====================
//CLASSE: ESDEVENIMENT PENDENT D'ENTREGAR AL FIL PRINCIPAL
//GUARDA QUIN TIPUS D'ESDEVENIMENT ÉS I EL TEXT QUE PORTI
//=====================
public class PendingEvent
{
    public const string Connected = "connected";
    public const string Message = "message";
    public const string Closed = "closed";

    public string Kind;
    public string Text;
}

//=====================
//CLASSE: WEBSOCKETSERVICE
//FUNCIONA A L'EDITOR I A BUILDS D'ESCRIPTORI, NO A WEBGL
//NO PARLA AMB SOCKET.IO, NOMÉS AMB UN SERVIDOR WEBSOCKET NORMAL
//=====================
public class WebSocketService : IDisposable
{
    //EVENTS QUE ES LLANCEN AL FIL PRINCIPAL
    public event Action OnConnected;
    public event Action<string> OnMessage;
    public event Action<string> OnClosed;

    //ESTAT INTERN: CUES, PANYS I SOCKET
    readonly ConcurrentQueue<PendingEvent> pending = new ConcurrentQueue<PendingEvent>();
    readonly SemaphoreSlim sendLock = new SemaphoreSlim(1, 1);

    ClientWebSocket socket;
    CancellationTokenSource cts;
    volatile bool closedByUser;

    //=====================
    //PROPIETAT: DIU SI EL SOCKET ESTÀ OBERT
    //=====================
    public bool IsConnected
    {
        get
        {
            if (socket == null)
            {
                return false;
            }

            if (socket.State != WebSocketState.Open)
            {
                return false;
            }

            return true;
        }
    }

    //=====================
    //MÈTODE: OBRE LA CONNEXIÓ I COMENÇA A ESCOLTAR
    //=====================
    public async Task ConnectAsync(string url)
    {
        closedByUser = false;
        cts = new CancellationTokenSource();
        socket = new ClientWebSocket();

        ClientWebSocket currentSocket = socket;
        CancellationToken token = cts.Token;

        //INTENTEM OBRIR LA CONNEXIÓ
        try
        {
            Uri uri = new Uri(url);
            await currentSocket.ConnectAsync(uri, token);
        }
        catch (Exception e)
        {
            EnqueueClosed("No s'ha pogut connectar: " + e.Message);
            return;
        }

        //SI HA ANAT BÉ AVISEM I COMENCEM A REBRE
        EnqueueConnected();
        _ = ReceiveLoop(currentSocket, token);
    }

    //=====================
    //MÈTODE: ENVIA UN TEXT AL SERVIDOR
    //=====================
    public async Task SendAsync(string json)
    {
        //SI NO HI HA CONNEXIÓ NO ENVIEM RES
        bool connected = IsConnected;
        if (connected == false)
        {
            UnityEngine.Debug.LogWarning("[WebSocket] missatge descartat, socket tancat: " + json);
            return;
        }

        byte[] bytes = Encoding.UTF8.GetBytes(json);

        await sendLock.WaitAsync();
        try
        {
            ArraySegment<byte> segment = new ArraySegment<byte>(bytes);
            await socket.SendAsync(segment, WebSocketMessageType.Text, true, cts.Token);
        }
        finally
        {
            sendLock.Release();
        }
    }

    //=====================
    //MÈTODE: TANCA LA CONNEXIÓ VOLUNTÀRIAMENT
    //=====================
    public async Task DisconnectAsync()
    {
        closedByUser = true;

        //SI EL SOCKET ESTÀ OBERT LI DEMANEM QUE ES TANQUI
        if (socket != null)
        {
            if (socket.State == WebSocketState.Open)
            {
                try
                {
                    await socket.CloseAsync(WebSocketCloseStatus.NormalClosure, "bye", CancellationToken.None);
                }
                catch (Exception)
                {
                    //SI JA ESTAVA TRENCADA NO CAL FER RES MÉS
                }
            }
        }

        if (cts != null)
        {
            cts.Cancel();
        }
    }

    //=====================
    //MÈTODE: PASSA ELS ESDEVENIMENTS PENDENTS AL FIL PRINCIPAL
    //S'HA DE CRIDAR A CADA UPDATE D'UN MONOBEHAVIOUR
    //=====================
    public void DispatchPending()
    {
        while (true)
        {
            PendingEvent item = null;
            bool hasItem = pending.TryDequeue(out item);
            if (hasItem == false)
            {
                break;
            }

            //SEGONS EL TIPUS D'ESDEVENIMENT, LLANCEM UN EVENT O UN ALTRE
            if (item.Kind == PendingEvent.Connected)
            {
                if (OnConnected != null)
                {
                    OnConnected.Invoke();
                }

                continue;
            }

            if (item.Kind == PendingEvent.Message)
            {
                if (OnMessage != null)
                {
                    OnMessage.Invoke(item.Text);
                }

                continue;
            }

            if (item.Kind == PendingEvent.Closed)
            {
                if (OnClosed != null)
                {
                    OnClosed.Invoke(item.Text);
                }

                continue;
            }
        }
    }

    //=====================
    //MÈTODE: ALLIBERA EL SOCKET I ELS RECURSOS
    //=====================
    public void Dispose()
    {
        closedByUser = true;

        if (cts != null)
        {
            cts.Cancel();
        }

        if (socket != null)
        {
            socket.Dispose();
        }
    }

    //=====================
    //MÈTODE: BUCLE DE RECEPCIÓ DE MISSATGES
    //MUNT A UN MISSATGE COMPLET I EL DEIXA A LA CUDA
    //=====================
    async Task ReceiveLoop(ClientWebSocket currentSocket, CancellationToken token)
    {
        byte[] buffer = new byte[8192];

        try
        {
            while (currentSocket.State == WebSocketState.Open)
            {
                //SI ENS HAN DEMANAT PARAR, SORTIM
                if (token.IsCancellationRequested)
                {
                    return;
                }

                MemoryStream messageStream = new MemoryStream();
                using (messageStream)
                {
                    WebSocketReceiveResult result;

                    //LLEGIM TROSSOS FINS QUE EL MISSATGE ESTIGUI COMPLET
                    do
                    {
                        ArraySegment<byte> segment = new ArraySegment<byte>(buffer);
                        result = await currentSocket.ReceiveAsync(segment, token);

                        //SI EL SERVIDOR VOL TANCAR, TANQUEM NOSALTRES TAMBÉ
                        if (result.MessageType == WebSocketMessageType.Close)
                        {
                            try
                            {
                                await currentSocket.CloseOutputAsync(WebSocketCloseStatus.NormalClosure, "", CancellationToken.None);
                            }
                            catch (Exception)
                            {
                                //SI JA ESTAVA TANCADA NO CAL FER RES MÉS
                            }

                            //NOMÉS AVISEM SI NO HA ESTAT UNA DESCONNEXIÓ VOLUNTÀRIA
                            if (closedByUser == false)
                            {
                                EnqueueClosed("El servidor ha tancat la connexió.");
                            }

                            return;
                        }

                        messageStream.Write(buffer, 0, result.Count);
                    }
                    while (result.EndOfMessage == false);

                    //NOMÉS ENS INTERESSEN ELS MISSATGES DE TEXT
                    if (result.MessageType == WebSocketMessageType.Text)
                    {
                        byte[] receivedBytes = messageStream.ToArray();
                        string text = Encoding.UTF8.GetString(receivedBytes);
                        EnqueueMessage(text);
                    }
                }
            }
        }
        catch (OperationCanceledException)
        {
            //DESCONNEXIÓ VOLUNTÀRIA
        }
        catch (Exception e)
        {
            //NOMÉS AVISEM SI NO HA ESTAT UNA DESCONNEXIÓ VOLUNTÀRIA
            if (closedByUser == false)
            {
                EnqueueClosed("Connexió perduda: " + e.Message);
            }
        }
    }

    //=====================
    //MÈTODE: DEIXA A LA CUDA L'AVÍS DE CONNEXIÓ OBERTA
    //=====================
    void EnqueueConnected()
    {
        PendingEvent item = new PendingEvent();
        item.Kind = PendingEvent.Connected;
        pending.Enqueue(item);
    }

    //=====================
    //MÈTODE: DEIXA A LA CUDA UN MISSATGE REBUT
    //=====================
    void EnqueueMessage(string text)
    {
        PendingEvent item = new PendingEvent();
        item.Kind = PendingEvent.Message;
        item.Text = text;
        pending.Enqueue(item);
    }

    //=====================
    //MÈTODE: DEIXA A LA CUDA L'AVÍS DE CONNEXIÓ TANCADA
    //=====================
    void EnqueueClosed(string reason)
    {
        PendingEvent item = new PendingEvent();
        item.Kind = PendingEvent.Closed;
        item.Text = reason;
        pending.Enqueue(item);
    }
}
