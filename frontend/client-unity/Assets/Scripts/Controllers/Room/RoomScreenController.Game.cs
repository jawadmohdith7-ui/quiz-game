//ARXIU QUE CONTROLA LES SECCIONS DE CONFIGURACIÓ, ESPERA, PREGUNTA I RESULTAT

//=====================
//IMPORTEM
//=====================
using System.Collections.Generic;
using System.Globalization;
using Models;
using UnityEngine;
using UnityEngine.UIElements;

//=====================
//CLASSE: ROOMSCREENCONTROLLER (PART DE JOC)
//=====================
public partial class RoomScreenController
{
    //=====================
    //ESTAT INTERN: CONFIGURACIÓ, ESPERA, PREGUNTA I RESULTAT
    //=====================
    DropdownField categorySelect;
    DropdownField difficultySelect;
    IntegerField roundsInput;
    IntegerField durationInput;
    Button saveConfigButton;
    Button startGameButton;
    Button readyButton;
    Label waitingText;
    Label questionText;
    Label countdown;
    TextField answerInput;
    Label answerUnit;
    Button sendAnswerButton;
    Label answerStatus;
    Label resultQuestionText;
    Label correctAnswerText;
    Label resultMessage;

    int maxPlayers;

    //PLACEHOLDER ORIGINAL DEL CAMP DE RESPOSTA
    string answerPlaceholder = "";

    //TEMPS QUAN ACABA LA RONDA (COM VUE: roundEndsAt)
    long roundEndsAt;
    int currentQuestionId;
    string currentQuestionText = "";

    //=====================
    //MÈTODE: BUSCA I CONNECTA ELS ELEMENTS DE JOC
    //=====================
    void QueryGameElements(VisualElement root)
    {
        categorySelect = root.Q<DropdownField>("category-select");
        difficultySelect = root.Q<DropdownField>("difficulty-select");
        roundsInput = root.Q<IntegerField>("rounds-input");
        durationInput = root.Q<IntegerField>("duration-input");
        saveConfigButton = root.Q<Button>("save-config-button");
        startGameButton = root.Q<Button>("start-game-button");
        readyButton = root.Q<Button>("ready-button");
        waitingText = root.Q<Label>("waiting-text");
        questionText = root.Q<Label>("question-text");
        countdown = root.Q<Label>("countdown");
        answerInput = root.Q<TextField>("answer-input");
        answerUnit = root.Q<Label>("answer-unit");
        sendAnswerButton = root.Q<Button>("send-answer-button");
        answerStatus = root.Q<Label>("answer-status");
        resultQuestionText = root.Q<Label>("result-question-text");
        correctAnswerText = root.Q<Label>("correct-answer-text");
        resultMessage = root.Q<Label>("result-message");

        if (saveConfigButton != null)
        {
            saveConfigButton.clicked += OnSaveConfigurationClicked;
        }

        if (startGameButton != null)
        {
            startGameButton.clicked += OnStartGameClicked;
        }

        if (readyButton != null)
        {
            readyButton.clicked += OnReadyClicked;
        }

        if (sendAnswerButton != null)
        {
            sendAnswerButton.clicked += SubmitAnswer;
        }

        if (answerInput != null)
        {
            answerInput.RegisterCallback<KeyDownEvent>(OnAnswerKeyDown);
            answerInput.pickingMode = PickingMode.Position;
            answerPlaceholder = answerInput.textEdition.placeholder;
            answerInput.RegisterCallback<FocusInEvent>(OnAnswerFocusIn);
            answerInput.RegisterCallback<FocusOutEvent>(OnAnswerFocusOut);
            answerInput.RegisterValueChangedCallback(OnAnswerValueChanged);
        }

        SetAnswerStatus("");
    }

    //=====================
    //CONFIGURACIÓ
    //=====================

    //CARREGA LES CATEGORIES DISPONIBLES AL DESPLEGABLE
    public void SetCategories(List<string> categories)
    {
        if (categorySelect == null)
        {
            return;
        }

        if (categories == null)
        {
            return;
        }

        List<string> choices = new List<string>(categories);
        if (choices.Contains("Mix") == false)
        {
            choices.Add("Mix");
        }

        categorySelect.choices = choices;
        if (choices.Contains(categorySelect.value) == false)
        {
            categorySelect.SetValueWithoutNotify("Mix");
        }
    }

    public void SetDifficulties(List<string> difficulties)
    {
        if (difficultySelect == null || difficulties == null)
        {
            return;
        }

        List<string> choices = new List<string>(difficulties);
        if (choices.Contains("mix") == false)
        {
            choices.Add("mix");
        }

        difficultySelect.choices = choices;
        if (choices.Contains(difficultySelect.value) == false)
        {
            difficultySelect.SetValueWithoutNotify("mix");
        }
    }

    //PINTA LA CONFIGURACIÓ QUE HA ENVIAT EL SERVIDOR
    //SI NO HI HA VALORS, USA ELS PER DEFECTE COM VUE
    public void SetConfiguration(RoomConfigurationData configuration)
    {
        if (configuration == null)
        {
            return;
        }

        //VALORS PER DEFECTE COM VUE (RoundSetup.vue)
        string defaultCategory = "Mix";
        string defaultDifficulty = "mix";
        int defaultMaxPlayers = 4;
        int defaultRounds = 5;
        int defaultDurationSeconds = 20;

        //USEM ELS VALORS DEL BACKEND O ELS PER DEFECTE
        string category = configuration.category;
        if (string.IsNullOrEmpty(category))
        {
            category = defaultCategory;
        }

        string difficulty = configuration.difficulty;
        if (string.IsNullOrEmpty(difficulty))
        {
            difficulty = defaultDifficulty;
        }

        int maxPlayers = configuration.maxPlayers;
        if (maxPlayers <= 0)
        {
            maxPlayers = defaultMaxPlayers;
        }

        int rounds = configuration.rounds;
        if (rounds <= 0)
        {
            rounds = defaultRounds;
        }

        int durationSeconds = configuration.durationSeconds;
        if (durationSeconds <= 0)
        {
            durationSeconds = defaultDurationSeconds;
        }

        //PINTEN ELS VALORS
        if (categorySelect != null)
        {
            categorySelect.SetValueWithoutNotify(category);
        }

        if (difficultySelect != null)
        {
            difficultySelect.SetValueWithoutNotify(difficulty);
        }

        if (roundsInput != null)
        {
            roundsInput.SetValueWithoutNotify(rounds);
        }

        if (durationInput != null)
        {
            durationInput.SetValueWithoutNotify(durationSeconds);
        }

        //GUARDEM MAXPLAYERS PER ENVIAR-LO AL SERVIDOR
        this.maxPlayers = maxPlayers;
    }

    //LLEGEIX LA CONFIGURACIÓ DELS CAMPS I LA LLANÇA
    void OnSaveConfigurationClicked()
    {
        RoomConfigurationData configuration = new RoomConfigurationData();
        configuration.category = ReadDropdown(categorySelect);
        configuration.difficulty = ReadDropdown(difficultySelect);
        configuration.maxPlayers = maxPlayers;
        configuration.rounds = ReadMinimum(roundsInput, 1);
        configuration.durationSeconds = ReadMinimum(durationInput, 0);

        //SI NINGÚ ESCOLTA L'ESDEVENIMENT NO HI HA RES MÉS A FER
        if (OnSaveConfiguration == null)
        {
            return;
        }

        OnSaveConfiguration.Invoke(configuration);
    }

    //EVENT: CLIC AL BOTÓ D'INICIAR PARTIDA
    void OnStartGameClicked()
    {
        //SI NINGÚ ESCOLTA L'ESDEVENIMENT NO HI HA RES MÉS A FER
        if (OnStartGame == null)
        {
            return;
        }

        OnStartGame.Invoke();
    }

    //=====================
    //ESPERA
    //=====================

    //PINTA EL TEXT DE L'ESPERA
    public void SetWaiting(string message)
    {
        if (waitingText == null)
        {
            return;
        }

        waitingText.text = message;
    }

    //EVENT: CLIC AL BOTÓ D'A PUNT: CANVIA L'ESTAT LOCAL I L'ANUNCIA
    void OnReadyClicked()
    {
        isReady = isReady == false;

        if (readyButton != null)
        {
            if (isReady == true)
            {
                readyButton.text = "No estic a punt";
            }
            else
            {
                readyButton.text = "Estic a punt";
            }
        }

        //SI NINGÚ ESCOLTA L'ESDEVENIMENT NO HI HA RES MÉS A FER
        if (OnReady == null)
        {
            return;
        }

        OnReady.Invoke(isReady);
    }

    //=====================
    //PREGUNTA
    //=====================

    //PINTA LA PREGUNTA I DESBLOQUEJA LA RESPOSTA
    public void SetQuestion(RoundStartedData data)
    {
        if (data == null)
        {
            return;
        }

        if (data.question != null)
        {
            currentQuestionId = data.question.id;
            currentQuestionText = data.question.text;

            if (questionText != null)
            {
                questionText.text = currentQuestionText;
            }
        }

        if (answerUnit != null)
        {
            answerUnit.text = data.question != null ? data.question.unit ?? "" : "";
        }

        if (answerInput != null)
        {
            answerInput.value = "";
            answerInput.SetEnabled(true);
            answerInput.EnableInClassList("input-error", false);
        }

        if (sendAnswerButton != null)
        {
            sendAnswerButton.SetEnabled(true);
            sendAnswerButton.text = "Enviar resposta";
        }

        SetAnswerStatus("");

        //GUARDEM QUAN ACABA LA RONDA (COM VUE: roundEndsAt = Date.now() + durationMs)
        long nowMs = System.DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
        roundEndsAt = nowMs + data.durationMs;

        SetCountdown(MillisecondsToSeconds(data.durationMs));
    }

    //ACTUALITZA EL COMPTE ENRERE CADA SEGON (COM VUE RoundTimer)
    public void Tick()
    {
        if (countdown == null)
        {
            return;
        }

        if (roundEndsAt <= 0)
        {
            return;
        }

        long nowMs = System.DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
        long remainingMs = roundEndsAt - nowMs;

        if (remainingMs <= 0)
        {
            countdown.text = "00:00";
            return;
        }

        int remainingSeconds = MillisecondsToSeconds(remainingMs).Value;
        countdown.text = FormatCountdown(remainingSeconds);
    }

    //PINTA ELS SEGONS QUE QUEDEN: NULL VOL DIR SENSE COMPTADOR
    public void SetCountdown(int? seconds)
    {
        if (countdown == null)
        {
            return;
        }

        countdown.text = FormatCountdown(seconds);
    }

    //PINTA L'ESTAT DE LA RESPOSTA ENVIADA
    public void SetAnswerStatus(string message)
    {
        if (answerStatus == null)
        {
            return;
        }

        if (string.IsNullOrEmpty(message))
        {
            answerStatus.text = "";
            return;
        }

        answerStatus.text = message;
    }

    //VALIDA I LLANÇA LA RESPOSTA: BLOQUEJA EL CAMP FINS A UNA PREGUNTA NOVA
    void SubmitAnswer()
    {
        if (answerInput == null)
        {
            return;
        }

        //SI EL CAMP JA ESTÀ BLOQUEJAT NO FEM RES
        if (answerInput.enabledSelf == false)
        {
            return;
        }

        double value = 0;
        bool isValid = TryParseNumber(answerInput.value, out value);

        //SI NO ÉS UN NÚMERO VÀLID, MARQUEM ERROR I NO ENVIEM
        if (isValid == false)
        {
            answerInput.EnableInClassList("input-error", true);
            return;
        }

        answerInput.EnableInClassList("input-error", false);

        int answer = (int)value;
        answerInput.SetEnabled(false);

        if (sendAnswerButton != null)
        {
            sendAnswerButton.SetEnabled(false);
            sendAnswerButton.text = "Resposta enviada";
        }

        SetAnswerStatus("Resposta enviada");

        //SI NINGÚ ESCOLTA L'ESDEVENIMENT NO HI HA RES MÉS A FER
        if (OnSendAnswer == null)
        {
            return;
        }

        OnSendAnswer.Invoke(currentQuestionId, answer);
    }

    //EVENT: TECLA PREM UDA AL CAMP DE RESPOSTA
    void OnAnswerKeyDown(KeyDownEvent evt)
    {
        //NOMÉS ENVIEM QUAN ES PREM INTRO O INTRO DEL TECLAT NUMÈRIC
        bool isReturn = evt.keyCode == KeyCode.Return;
        bool isKeypadEnter = evt.keyCode == KeyCode.KeypadEnter;

        if (isReturn == false)
        {
            if (isKeypadEnter == false)
            {
                return;
            }
        }

        SubmitAnswer();
    }

    //=====================
    //CAMP DE RESPOSTA: PLACEHOLDER I FILTRE DE CARÀCTERS
    //=====================

    //BUIDA EL PLACEHOLDER EN REBRE FOCUS, COM UN INPUT WEB
    void OnAnswerFocusIn(FocusInEvent evt)
    {
        if (answerInput == null)
        {
            return;
        }

        answerInput.textEdition.placeholder = "";
    }

    //TORNA A POSAR EL PLACEHOLDER EN PERDRE EL FOCUS
    void OnAnswerFocusOut(FocusOutEvent evt)
    {
        if (answerInput == null)
        {
            return;
        }

        answerInput.textEdition.placeholder = answerPlaceholder;
    }

    //NOMÉS DÍGITS, UN SEPARADOR DECIMAL I EL SIGNE NEGATIU AL DAVANT
    void OnAnswerValueChanged(ChangeEvent<string> evt)
    {
        if (answerInput == null)
        {
            return;
        }

        if (IsValidAnswerInput(evt.newValue) == false)
        {
            answerInput.SetValueWithoutNotify(evt.previousValue);
        }
    }

    //=====================
    //RESULTAT
    //=====================

    //PINTA EL RESULTAT DE LA RONDA
    public void SetResult(RoundResultsData data)
    {
        if (data == null)
        {
            return;
        }

        if (resultQuestionText != null)
        {
            resultQuestionText.text = currentQuestionText;
        }

        if (correctAnswerText != null)
        {
            correctAnswerText.text = BuildCorrectAnswer(data);
        }

        if (resultMessage != null)
        {
            resultMessage.text = BuildResultMessage(data);
        }
    }

    //TEXT DE LA RESPOSTA CORRECTA AMB LA UNITAT
    static string BuildCorrectAnswer(RoundResultsData data)
    {
        string text = FormatNumber(data.correctAnswer);

        if (string.IsNullOrEmpty(data.unit))
        {
            return text;
        }

        return text + " " + data.unit;
    }

    //TEXT DEL RESULTAT PROPI: SI EL BLOC "YOU" ÉS NULL SOM UN OBSERVADOR
    static string BuildResultMessage(RoundResultsData data)
    {
        if (data.you == null)
        {
            return data.explanation;
        }

        string answerText = "-";

        if (data.you.answer.HasValue == true)
        {
            answerText = FormatNumber(data.you.answer.Value);
        }

        string message = "La teva resposta: " + answerText;
        message = message + " · +" + data.you.roundPoints + " punts";
        message = message + " · posició " + data.you.position;

        if (string.IsNullOrEmpty(data.explanation))
        {
            return message;
        }

        return message + "\n" + data.explanation;
    }

    //=====================
    //AJUDANTS
    //=====================

    //VALOR D'UN DESPLEGABLE, BUID SI NO EXISTEIX
    static string ReadDropdown(DropdownField field)
    {
        if (field == null)
        {
            return "";
        }

        if (string.IsNullOrEmpty(field.value))
        {
            return "";
        }

        return field.value;
    }

    //VALOR D'UN CAMP ENTER AMB UN MÍNIM
    static int ReadMinimum(IntegerField field, int minimum)
    {
        if (field == null)
        {
            return minimum;
        }

        if (field.value < minimum)
        {
            return minimum;
        }

        return field.value;
    }

    //MIL·LISEGONS A SEGONS: ZERO O NEGATIU VOL DIR SENSE COMPTADOR
    static int? MillisecondsToSeconds(long milliseconds)
    {
        if (milliseconds <= 0)
        {
            return null;
        }

        return (int)(milliseconds / 1000);
    }

    //FORMAT DEL COMPTADOR: SENSE VALOR MOSTREM GUIÓ
    static string FormatCountdown(int? seconds)
    {
        if (seconds.HasValue == false)
        {
            return "--:--";
        }

        int totalSeconds = seconds.Value;
        int minutes = totalSeconds / 60;
        int remainingSeconds = totalSeconds % 60;
        return string.Format("{0:00}:{1:00}", minutes, remainingSeconds);
    }

    //FORMAT D'UN NÚMERO SENSE MILES I AMB PUNT DECIMAL
    static string FormatNumber(double value)
    {
        return value.ToString("0.##", CultureInfo.InvariantCulture);
    }

    static bool IsValidAnswerInput(string s)
    {
        return System.Text.RegularExpressions.Regex.IsMatch(s, @"^-?[0-9]*[.,]?[0-9]*$");
    }

    //CONVERTEIX EL TEXT A NÚMERO: ACCEPTA COMA O PUNT, NO ACCEPTA MILES
    static bool TryParseNumber(string raw, out double value)
    {
        string trimmed = raw.Trim();
        string withoutSpaces = trimmed.Replace(" ", "");
        string withDot = withoutSpaces.Replace(',', '.');

        bool parsed = double.TryParse(withDot, NumberStyles.Float, CultureInfo.InvariantCulture, out value);
        return parsed;
    }
}
