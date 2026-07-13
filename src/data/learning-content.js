import deepDiveSources from "./deep-dive-sources.js";

const t = (en, pt) => ({ en, pt });

const learning = [
  {
    number: 3,
    deepDive: [
      {
        source: "CCC 1766, 1774",
        title: t("Love seeks the good", "O amor procura o bem"),
        body: t(
          "Christian love is more than an emotion. It chooses the good of the other person, while feelings become morally meaningful through the decisions and actions they inspire.",
          "O amor cristão é mais do que uma emoção. Ele escolhe o bem da outra pessoa, enquanto os sentimentos adquirem sentido moral por meio das decisões e ações que inspiram.",
        ),
      },
      {
        source: "Amoris Laetitia 39; Gn 2,24",
        title: t("From attraction to covenant", "Da atração à aliança"),
        body: t(
          "A culture of the temporary treats every bond as replaceable. Scripture instead presents love as a faithful communion in which two people become one flesh and learn to remain.",
          "Uma cultura do provisório trata todo vínculo como substituível. A Escritura, ao contrário, apresenta o amor como uma comunhão fiel, na qual duas pessoas se tornam uma só carne e aprendem a permanecer.",
        ),
      },
    ],
    games: [
      {
        type: "sequence",
        prompt: t("Put the path of mature love in order.", "Coloque o caminho do amor maduro na ordem certa."),
        items: [
          { id: "feel", label: t("Feel attraction", "Sentir atração") },
          { id: "choose", label: t("Choose the other’s good", "Escolher o bem do outro") },
          { id: "remain", label: t("Practice fidelity", "Praticar a fidelidade") },
        ],
        answer: ["feel", "choose", "remain"],
      },
      {
        type: "match",
        prompt: t("Match each part of love with its role.", "Associe cada dimensão do amor à sua função."),
        pairs: [
          [t("Feeling", "Sentimento"), t("Can change", "Pode mudar")],
          [t("Decision", "Decisão"), t("Chooses the good", "Escolhe o bem")],
          [t("Fidelity", "Fidelidade"), t("Gives love roots", "Dá raízes ao amor")],
        ],
      },
      {
        type: "choice",
        prompt: t("The first excitement has faded. What best expresses love?", "O entusiasmo inicial diminuiu. O que melhor expressa o amor?"),
        options: [
          t("Assume the relationship is over", "Presumir que o relacionamento acabou"),
          t("Talk honestly and choose one concrete act of care", "Conversar com sinceridade e escolher um gesto concreto de cuidado"),
          t("Look for a more exciting person", "Procurar uma pessoa mais emocionante"),
        ],
        correct: 1,
      },
    ],
    quiz: [
      {
        prompt: t("What is love built on?", "Sobre o que o amor é construído?"),
        options: [t("Feelings alone", "Somente sentimentos"), t("Feeling, decision, and fidelity", "Sentimento, decisão e fidelidade"), t("Compatibility alone", "Somente compatibilidade")],
        correct: 1,
      },
      {
        prompt: t("Can love grow after feelings change?", "O amor pode crescer depois que os sentimentos mudam?"),
        options: [t("Yes, through faithful choices", "Sim, por meio de escolhas fiéis"), t("No, change proves it was false", "Não, a mudança prova que era falso"), t("Only by avoiding difficulties", "Somente evitando dificuldades")],
        correct: 0,
      },
      {
        prompt: t("Who benefits from stable love?", "Quem se beneficia de um amor estável?"),
        options: [t("Only the couple", "Somente o casal"), t("The couple, children, and community", "O casal, os filhos e a comunidade"), t("Nobody in particular", "Ninguém em particular")],
        correct: 1,
      },
    ],
    saintQuote: {
      text: t("Love never ends.", "O amor jamais acabará."),
      author: t("Saint Paul", "São Paulo"),
      source: "1Cor 13,8",
    },
    reflectionPrompt: t("What makes love more than a passing feeling?", "O que torna o amor mais do que um sentimento passageiro?"),
  },
  {
    number: 14,
    deepDive: [
      {
        source: "CCC 2390; YOUCAT 407",
        title: t("The body speaks", "O corpo fala"),
        body: t(
          "Sexual union is never merely physical. The body expresses the person and says something about trust, belonging, and self-gift. Chastity protects the truth of that language.",
          "A união sexual nunca é meramente física. O corpo expressa a pessoa e diz algo sobre confiança, pertença e dom de si. A castidade protege a verdade dessa linguagem.",
        ),
      },
      {
        source: "Amoris Laetitia 153; Humanae Vitae 12",
        title: t("A total gift needs a total promise", "Um dom total precisa de uma promessa total"),
        body: t(
          "Sex joins tenderness, bodily union, and openness to life. Its meaning is safeguarded when it expresses an exclusive and lasting covenant rather than a temporary agreement.",
          "O sexo une ternura, união corporal e abertura à vida. Seu significado é protegido quando expressa uma aliança exclusiva e duradoura, e não um acordo temporário.",
        ),
      },
    ],
    games: [
      {
        type: "sequence",
        prompt: t("Put the logic of self-gift in order.", "Coloque a lógica do dom de si na ordem certa."),
        items: [
          { id: "dignity", label: t("Recognize dignity", "Reconhecer a dignidade") },
          { id: "promise", label: t("Make a lasting promise", "Fazer uma promessa duradoura") },
          { id: "gift", label: t("Give yourself bodily", "Entregar-se corporalmente") },
        ],
        answer: ["dignity", "promise", "gift"],
      },
      {
        type: "match",
        prompt: t("Match the sign with what it communicates.", "Associe o sinal ao que ele comunica."),
        pairs: [
          [t("Body", "Corpo"), t("The whole person", "A pessoa inteira")],
          [t("Sex", "Sexo"), t("Total self-gift", "Dom total de si")],
          [t("Marriage", "Matrimônio"), t("A public, lasting yes", "Um sim público e duradouro")],
        ],
      },
      {
        type: "choice",
        prompt: t("Someone says: “It is only physical.” What is missing?", "Alguém diz: “É apenas físico”. O que está faltando?"),
        options: [
          t("Nothing; the body has no meaning", "Nada; o corpo não tem significado"),
          t("The body expresses the person and deserves truth", "O corpo expressa a pessoa e merece verdade"),
          t("Only stronger feelings", "Somente sentimentos mais fortes"),
        ],
        correct: 1,
      },
    ],
    quiz: [
      {
        prompt: t("Why is sex not merely private recreation?", "Por que o sexo não é apenas uma diversão privada?"),
        options: [t("It expresses the whole person", "Ele expressa a pessoa inteira"), t("Because society dislikes it", "Porque a sociedade não gosta"), t("Because attraction is wrong", "Porque a atração é errada")],
        correct: 0,
      },
      {
        prompt: t("What protects the truth of sexual self-gift?", "O que protege a verdade do dom sexual de si?"),
        options: [t("Secrecy", "Segredo"), t("An exclusive and lasting covenant", "Uma aliança exclusiva e duradoura"), t("A temporary agreement", "Um acordo temporário")],
        correct: 1,
      },
      {
        prompt: t("Chastity primarily means…", "A castidade significa principalmente…"),
        options: [t("Rejecting the body", "Rejeitar o corpo"), t("Integrating sexuality with love and dignity", "Integrar a sexualidade ao amor e à dignidade"), t("Never feeling attraction", "Nunca sentir atração")],
        correct: 1,
      },
    ],
    saintQuote: {
      text: t("Glorify God in your body.", "Glorificai, portanto, a Deus no vosso corpo."),
      author: t("Saint Paul", "São Paulo"),
      source: "1Cor 6,20",
    },
    reflectionPrompt: t("What does the body communicate in sexual intimacy?", "O que o corpo comunica na intimidade sexual?"),
  },
  {
    number: 25,
    deepDive: [
      {
        source: "CCC 2690",
        title: t("Wisdom receives accompaniment", "A sabedoria aceita acompanhamento"),
        body: t(
          "The Church recommends spiritual guidance from a wise and experienced person. A director helps someone notice God’s action, test movements of the heart, and grow in prayer.",
          "A Igreja recomenda a orientação espiritual de uma pessoa sábia e experiente. O orientador ajuda a perceber a ação de Deus, discernir os movimentos do coração e crescer na oração.",
        ),
      },
      {
        source: "Christus Vivit 246; Lc 24,13-35",
        title: t("Accompaniment respects freedom", "O acompanhamento respeita a liberdade"),
        body: t(
          "Like Jesus on the road to Emmaus, a good guide listens, walks alongside, opens Scripture, and leaves the person free to respond. Manipulation and dependency contradict spiritual direction.",
          "Como Jesus no caminho de Emaús, um bom orientador escuta, caminha ao lado, abre a Escritura e deixa a pessoa livre para responder. Manipulação e dependência contradizem a orientação espiritual.",
        ),
      },
    ],
    games: [
      {
        type: "sequence",
        prompt: t("Put a good discernment conversation in order.", "Coloque uma boa conversa de discernimento na ordem certa."),
        items: [
          { id: "listen", label: t("Listen to life", "Escutar a vida") },
          { id: "gospel", label: t("Read it in Gospel light", "Lê-la à luz do Evangelho") },
          { id: "free", label: t("Decide freely", "Decidir livremente") },
        ],
        answer: ["listen", "gospel", "free"],
      },
      {
        type: "match",
        prompt: t("Recognize healthy direction.", "Reconheça uma orientação saudável."),
        pairs: [
          [t("Good guide", "Bom orientador"), t("Listens and encourages", "Escuta e encoraja")],
          [t("Manipulator", "Manipulador"), t("Controls and creates dependence", "Controla e cria dependência")],
          [t("Direction", "Orientação"), t("Serves vocation and freedom", "Serve à vocação e à liberdade")],
        ],
      },
      {
        type: "choice",
        prompt: t("A director tells you exactly whom to marry. What should you notice?", "Um orientador diz exatamente com quem você deve se casar. O que deve perceber?"),
        options: [
          t("That is normal spiritual authority", "Isso é autoridade espiritual normal"),
          t("A guide must respect freedom and not decide for you", "O orientador deve respeitar a liberdade e não decidir por você"),
          t("You should stop discerning", "Você deve parar de discernir"),
        ],
        correct: 1,
      },
    ],
    quiz: [
      {
        prompt: t("What is the director’s role?", "Qual é a função do orientador?"),
        options: [t("Make decisions for you", "Tomar decisões por você"), t("Help you recognize God’s action", "Ajudar a reconhecer a ação de Deus"), t("Replace prayer", "Substituir a oração")],
        correct: 1,
      },
      {
        prompt: t("Can a confessor also be a spiritual director?", "Um confessor também pode ser orientador espiritual?"),
        options: [t("Yes, but it is not required", "Sim, mas não é obrigatório"), t("Never", "Nunca"), t("Only for priests", "Somente para sacerdotes")],
        correct: 0,
      },
      {
        prompt: t("A sign of good direction is…", "Um sinal de boa orientação é…"),
        options: [t("Greater dependence on the guide", "Maior dependência do orientador"), t("More freedom, prayer, and courage", "Mais liberdade, oração e coragem"), t("Fear of making mistakes", "Medo de errar")],
        correct: 1,
      },
    ],
    saintQuote: {
      text: t("Do not be afraid. Open wide the doors to Christ.", "Não tenhais medo. Abri, antes, escancarai as portas a Cristo."),
      author: t("Saint John Paul II", "São João Paulo II"),
      source: t("Inaugural homily, 22 October 1978", "Homilia inaugural, 22 de outubro de 1978"),
    },
    reflectionPrompt: t("What would you hope to receive from spiritual direction?", "O que você esperaria receber da orientação espiritual?"),
  },
  {
    number: 34,
    deepDive: [
      {
        source: "Mt 6,21-23; YOUCAT 412",
        title: t("Protect the gaze, protect the heart", "Proteger o olhar, proteger o coração"),
        body: t(
          "What we repeatedly look at shapes desire and imagination. Guarding the eyes is not fear of beauty; it is freedom from images that turn persons into objects.",
          "Aquilo que olhamos repetidamente molda o desejo e a imaginação. Guardar os olhos não é ter medo da beleza; é libertar-se de imagens que transformam pessoas em objetos.",
        ),
      },
      {
        source: "Christus Vivit 88, 90; Amoris Laetitia 151",
        title: t("Freedom needs a concrete plan", "A liberdade precisa de um plano concreto"),
        body: t(
          "Digital temptation is strongest in isolation. Friendship, prayer, confession, filters, and changing the physical situation are practical ways of protecting freedom and beginning again after a fall.",
          "A tentação digital é mais forte no isolamento. Amizade, oração, confissão, filtros e mudança da situação concreta são meios práticos de proteger a liberdade e recomeçar depois de uma queda.",
        ),
      },
    ],
    games: [
      {
        type: "sequence",
        prompt: t("A triggering image appears. Put the response in order.", "Surge uma imagem provocante. Coloque a resposta na ordem certa."),
        items: [
          { id: "close", label: t("Close it immediately", "Fechá-la imediatamente") },
          { id: "move", label: t("Move out of isolation", "Sair do isolamento") },
          { id: "contact", label: t("Contact a trusted person", "Procurar uma pessoa de confiança") },
        ],
        answer: ["close", "move", "contact"],
      },
      {
        type: "match",
        prompt: t("Match the risk with a helpful response.", "Associe o risco a uma resposta útil."),
        pairs: [
          [t("Trigger", "Gatilho"), t("Prepare a plan", "Preparar um plano")],
          [t("Isolation", "Isolamento"), t("Seek accountability", "Buscar acompanhamento")],
          [t("A fall", "Uma queda"), t("Confession and a new start", "Confissão e recomeço")],
        ],
      },
      {
        type: "choice",
        prompt: t("You are alone, tired, and tempted. What is the strongest first move?", "Você está sozinho, cansado e tentado. Qual é o primeiro passo mais forte?"),
        options: [
          t("Keep scrolling to test your willpower", "Continuar rolando para testar a força de vontade"),
          t("Close the screen, change place, and message someone", "Fechar a tela, mudar de lugar e mandar mensagem a alguém"),
          t("Promise that tomorrow will be different", "Prometer que amanhã será diferente"),
        ],
        correct: 1,
      },
    ],
    quiz: [
      {
        prompt: t("Is looking away enough in every situation?", "Desviar o olhar basta em toda situação?"),
        options: [t("Always", "Sempre"), t("Not always; a strategy and support may be needed", "Nem sempre; pode ser necessário um plano e apoio"), t("Never", "Nunca")],
        correct: 1,
      },
      {
        prompt: t("Why is pornography harmful?", "Por que a pornografia faz mal?"),
        options: [t("It objectifies persons and damages freedom", "Ela objetifica pessoas e prejudica a liberdade"), t("Only because it wastes time", "Somente porque faz perder tempo"), t("Only when someone is married", "Somente quando alguém é casado")],
        correct: 0,
      },
      {
        prompt: t("Asking for help is…", "Pedir ajuda é…"),
        options: [t("A failure", "Um fracasso"), t("A concrete act of freedom", "Um ato concreto de liberdade"), t("Necessary only in extreme cases", "Necessário somente em casos extremos")],
        correct: 1,
      },
    ],
    saintQuote: {
      text: t("Do not be overcome by evil, but overcome evil with good.", "Não te deixes vencer pelo mal, mas vence o mal com o bem."),
      author: t("Saint Paul", "São Paulo"),
      source: "Rm 12,21",
    },
    reflectionPrompt: t("What concrete strategy protects freedom when temptation appears?", "Que estratégia concreta protege a liberdade quando surge a tentação?"),
  },
  {
    number: 59,
    deepDive: [
      {
        source: "CCC 2347; YOUCAT 404",
        title: t("Chastity makes friendship possible", "A castidade torna a amizade possível"),
        body: t(
          "Chastity integrates sexuality into the person. It frees a man and a woman to see each other as persons rather than possibilities for conquest, and it strengthens authentic friendship.",
          "A castidade integra a sexualidade na pessoa. Ela liberta o homem e a mulher para se verem como pessoas, e não como possibilidades de conquista, e fortalece a amizade autêntica.",
        ),
      },
      {
        source: "Pr 2,11-17",
        title: t("Friendship needs truth and boundaries", "A amizade precisa de verdade e limites"),
        body: t(
          "A good friendship seeks the other’s good. Honest attention to attraction, time, physical closeness, and expectations prevents ambiguity from quietly becoming manipulation or betrayal.",
          "Uma boa amizade procura o bem do outro. A atenção sincera à atração, ao tempo, à proximidade física e às expectativas impede que a ambiguidade se transforme silenciosamente em manipulação ou traição.",
        ),
      },
    ],
    games: [
      {
        type: "sequence",
        prompt: t("Put an honest friendship check in order.", "Coloque uma verificação sincera da amizade na ordem certa."),
        items: [
          { id: "name", label: t("Name your feelings", "Nomear os sentimentos") },
          { id: "clarify", label: t("Clarify expectations", "Esclarecer as expectativas") },
          { id: "boundary", label: t("Choose truthful boundaries", "Escolher limites verdadeiros") },
        ],
        answer: ["name", "clarify", "boundary"],
      },
      {
        type: "match",
        prompt: t("Match the behavior with its meaning.", "Associe o comportamento ao seu significado."),
        pairs: [
          [t("Friendship", "Amizade"), t("Seeks the other’s good", "Procura o bem do outro")],
          [t("Ambiguous flirting", "Flerte ambíguo"), t("Can create false hope", "Pode criar falsas esperanças")],
          [t("Boundary", "Limite"), t("Protects truth and freedom", "Protege a verdade e a liberdade")],
        ],
      },
      {
        type: "choice",
        prompt: t("One friend wants more and the other does not. What is loving?", "Um amigo quer algo a mais e o outro não. O que é amoroso?"),
        options: [
          t("Keep everything ambiguous", "Manter tudo ambíguo"),
          t("Speak honestly and adjust the distance if needed", "Conversar com sinceridade e ajustar a distância, se necessário"),
          t("Use jealousy to clarify feelings", "Usar o ciúme para esclarecer os sentimentos"),
        ],
        correct: 1,
      },
    ],
    quiz: [
      {
        prompt: t("Can a man and a woman be friends?", "Um homem e uma mulher podem ser amigos?"),
        options: [t("Yes, with honesty and boundaries", "Sim, com sinceridade e limites"), t("Never", "Nunca"), t("Only if neither ever feels attraction", "Somente se nenhum dos dois sentir atração")],
        correct: 0,
      },
      {
        prompt: t("What question is especially useful?", "Que pergunta é especialmente útil?"),
        options: [t("Would this still feel right if others knew?", "Isso continuaria parecendo correto se outros soubessem?"), t("How can I keep this secret?", "Como posso manter isso em segredo?"), t("How do I avoid every difficult conversation?", "Como evitar toda conversa difícil?")],
        correct: 0,
      },
      {
        prompt: t("What does chastity contribute to friendship?", "O que a castidade oferece à amizade?"),
        options: [t("Fear", "Medo"), t("Freedom to see the whole person", "Liberdade para ver a pessoa inteira"), t("Emotional distance", "Distância emocional")],
        correct: 1,
      },
    ],
    saintQuote: {
      text: t("Beloved, let us love one another, because love is from God.", "Caríssimos, amemo-nos uns aos outros, porque o amor vem de Deus."),
      author: t("Saint John", "São João"),
      source: "1Jo 4,7",
    },
    reflectionPrompt: t("Which boundaries help friendship remain truthful and free?", "Quais limites ajudam a amizade a permanecer verdadeira e livre?"),
  },
  {
    number: 68,
    deepDive: [
      {
        source: "CCC 2350; YOUCAT 407",
        title: t("Engagement is a school of trust", "O noivado é uma escola de confiança"),
        body: t(
          "Engaged couples are invited to live continence and grow in tenderness, prayer, communication, and knowledge of one another. This prepares a free rather than experimental self-gift.",
          "Os noivos são convidados a viver a continência e crescer em ternura, oração, comunicação e conhecimento mútuo. Isso prepara um dom de si livre, e não experimental.",
        ),
      },
      {
        source: "Amoris Laetitia 74, 132; Familiaris Consortio 11",
        title: t("Compatibility is larger than sex", "A compatibilidade é maior do que o sexo"),
        body: t(
          "A lifelong union depends on character, faith, conflict, family, responsibility, and shared vocation. Sexual intimacy grows through trust; it cannot function as a reliable entrance exam for marriage.",
          "Uma união para toda a vida depende do caráter, da fé, da forma de lidar com conflitos, da família, da responsabilidade e da vocação comum. A intimidade sexual cresce com a confiança; ela não funciona como exame de admissão confiável para o matrimônio.",
        ),
      },
    ],
    games: [
      {
        type: "sequence",
        prompt: t("Put the path to sexual self-gift in order.", "Coloque o caminho para o dom sexual de si na ordem certa."),
        items: [
          { id: "know", label: t("Know the whole person", "Conhecer a pessoa inteira") },
          { id: "promise", label: t("Make a definitive promise", "Fazer uma promessa definitiva") },
          { id: "give", label: t("Give yourself completely", "Entregar-se completamente") },
        ],
        answer: ["know", "promise", "give"],
      },
      {
        type: "match",
        prompt: t("What really tests compatibility?", "O que realmente revela a compatibilidade?"),
        pairs: [
          [t("Shared values", "Valores comuns"), t("Direction for life", "Direção para a vida")],
          [t("Conflict", "Conflito"), t("Capacity to reconcile", "Capacidade de reconciliar")],
          [t("Sex", "Sexo"), t("Vulnerable total gift", "Dom total e vulnerável")],
        ],
      },
      {
        type: "choice",
        prompt: t("A couple wants to “test” marriage through sex. What should they explore first?", "Um casal quer “testar” o matrimônio por meio do sexo. O que deveria explorar primeiro?"),
        options: [
          t("Only physical chemistry", "Somente a química física"),
          t("Trust, faith, conflict, responsibility, and vocation", "Confiança, fé, conflitos, responsabilidade e vocação"),
          t("Whether friends approve", "Se os amigos aprovam"),
        ],
        correct: 1,
      },
    ],
    quiz: [
      {
        prompt: t("Does a first sexual experience predict married intimacy?", "A primeira experiência sexual prevê a intimidade no matrimônio?"),
        options: [t("Reliably", "De modo confiável"), t("No; intimacy grows with trust and time", "Não; a intimidade cresce com confiança e tempo"), t("Only for engaged couples", "Somente para noivos")],
        correct: 1,
      },
      {
        prompt: t("What does sex presuppose?", "O que o sexo pressupõe?"),
        options: [t("A definitive yes to the person", "Um sim definitivo à pessoa"), t("A temporary trial", "Uma experiência temporária"), t("Perfect technique", "Técnica perfeita")],
        correct: 0,
      },
      {
        prompt: t("Before marriage, affection should…", "Antes do matrimônio, o carinho deve…"),
        options: [t("Help the couple know each other without complete self-gift", "Ajudar o casal a se conhecer sem a entrega total"), t("Avoid all tenderness", "Evitar toda ternura"), t("Replace honest conversation", "Substituir a conversa sincera")],
        correct: 0,
      },
    ],
    saintQuote: {
      text: t("Love includes the human body, and the body is made a sharer in spiritual love.", "O amor compreende também o corpo humano e o corpo torna-se participante do amor espiritual."),
      author: t("Saint John Paul II", "São João Paulo II"),
      source: "Familiaris Consortio 11",
    },
    reflectionPrompt: t("Which signs reveal compatibility more deeply than sexual chemistry?", "Quais sinais revelam uma compatibilidade mais profunda do que a química sexual?"),
  },
  {
    number: 83,
    deepDive: [
      {
        source: "CCC 2350; Amoris Laetitia 132",
        title: t("Love needs a free and definitive yes", "O amor precisa de um sim livre e definitivo"),
        body: t(
          "Living together can make a relationship advance through habit and practical dependence before the couple has freely made a covenant. Christian marriage asks for an explicit, public, and permanent consent.",
          "Morar juntos pode fazer o relacionamento avançar por hábito e dependência prática antes que o casal tenha feito livremente uma aliança. O matrimônio cristão pede um consentimento explícito, público e permanente.",
        ),
      },
      {
        source: "Familiaris Consortio 81; DOCAT 8",
        title: t("Discern the whole shared life", "Discernir toda a vida comum"),
        body: t(
          "A common home involves faith, work, money, family, children, suffering, and service. These realities need honest discernment; sexual bonding should not hide serious incompatibilities or postpone commitment.",
          "Uma casa comum envolve fé, trabalho, dinheiro, família, filhos, sofrimento e serviço. Essas realidades exigem discernimento sincero; o vínculo sexual não deve esconder incompatibilidades sérias nem adiar o compromisso.",
        ),
      },
    ],
    games: [
      {
        type: "sequence",
        prompt: t("Put the path toward a shared home in order.", "Coloque o caminho para uma casa comum na ordem certa."),
        items: [
          { id: "discern", label: t("Discern a shared future", "Discernir um futuro comum") },
          { id: "promise", label: t("Promise freely and publicly", "Prometer livre e publicamente") },
          { id: "home", label: t("Build the common home", "Construir a casa comum") },
        ],
        answer: ["discern", "promise", "home"],
      },
      {
        type: "match",
        prompt: t("Match each stage with its task.", "Associe cada etapa à sua tarefa."),
        pairs: [
          [t("Dating", "Namoro"), t("Know and discern", "Conhecer e discernir")],
          [t("Engagement", "Noivado"), t("Prepare a free covenant", "Preparar uma aliança livre")],
          [t("Marriage", "Matrimônio"), t("Live the definitive yes", "Viver o sim definitivo")],
        ],
      },
      {
        type: "choice",
        prompt: t("A couple wants to move in “to see if it works.” What is the deeper question?", "Um casal quer morar junto “para ver se dá certo”. Qual é a pergunta mais profunda?"),
        options: [
          t("Whether sharing rent is convenient", "Se dividir o aluguel é conveniente"),
          t("Whether they freely choose a lifelong covenant", "Se escolhem livremente uma aliança para toda a vida"),
          t("Whether they have matching furniture", "Se têm móveis combinando"),
        ],
        correct: 1,
      },
    ],
    quiz: [
      {
        prompt: t("What is missing from “trying out” marriage?", "O que falta ao “experimentar” o matrimônio?"),
        options: [t("A larger apartment", "Um apartamento maior"), t("The unconditional public promise", "A promessa pública e incondicional"), t("More feelings", "Mais sentimentos")],
        correct: 1,
      },
      {
        prompt: t("Why can cohabitation complicate discernment?", "Por que a coabitação pode complicar o discernimento?"),
        options: [t("Dependence and bonding can hide unresolved problems", "Dependência e vínculo podem esconder problemas não resolvidos"), t("It makes conversation impossible", "Ela torna impossível conversar"), t("It guarantees marriage", "Ela garante o matrimônio")],
        correct: 0,
      },
      {
        prompt: t("Love says yes…", "O amor diz sim…"),
        options: [t("Until life becomes difficult", "Até a vida ficar difícil"), t("Without an expiry date or secret exit", "Sem prazo de validade nem saída secreta"), t("Only while feelings remain intense", "Somente enquanto os sentimentos forem intensos")],
        correct: 1,
      },
    ],
    saintQuote: {
      text: t("The future of humanity passes by way of the family.", "O futuro da humanidade passa pela família."),
      author: t("Saint John Paul II", "São João Paulo II"),
      source: "Familiaris Consortio 86",
    },
    reflectionPrompt: t("What does a public, lifelong promise add to shared life?", "O que uma promessa pública e definitiva acrescenta à vida em comum?"),
  },
  {
    number: 126,
    deepDive: [
      {
        source: "CCC 1615; YOUCAT 263",
        title: t("Fidelity is grace and daily work", "A fidelidade é graça e trabalho diário"),
        body: t(
          "Jesus does not simply command lifelong fidelity; he gives spouses grace to live it. The sacramental promise becomes a daily pattern of reconciliation, patience, encouragement, and prayer.",
          "Jesus não apenas ordena a fidelidade para toda a vida; ele dá aos esposos a graça para vivê-la. A promessa sacramental torna-se um caminho diário de reconciliação, paciência, encorajamento e oração.",
        ),
      },
      {
        source: "Amoris Laetitia 62, 162; Familiaris Consortio 13",
        title: t("Love matures beyond infatuation", "O amor amadurece além da paixão"),
        body: t(
          "When early intensity changes, love can become steadier and more personal. Fidelity means repeatedly choosing the other’s good and allowing God’s faithfulness to strengthen human weakness.",
          "Quando a intensidade inicial muda, o amor pode tornar-se mais firme e pessoal. Fidelidade significa escolher repetidamente o bem do outro e permitir que a fidelidade de Deus fortaleça a fraqueza humana.",
        ),
      },
    ],
    games: [
      {
        type: "sequence",
        prompt: t("After a conflict, put fidelity into action.", "Depois de um conflito, coloque a fidelidade em prática."),
        items: [
          { id: "return", label: t("Take the first step", "Dar o primeiro passo") },
          { id: "listen", label: t("Listen and repair", "Escutar e reparar") },
          { id: "renew", label: t("Renew the shared yes", "Renovar o sim comum") },
        ],
        answer: ["return", "listen", "renew"],
      },
      {
        type: "match",
        prompt: t("Match faithful love with its action.", "Associe o amor fiel à sua ação."),
        pairs: [
          [t("Weakness", "Fraqueza"), t("Patient support", "Apoio paciente")],
          [t("Success", "Sucesso"), t("Celebrate together", "Celebrar juntos")],
          [t("Conflict", "Conflito"), t("Reconcile creatively", "Reconciliar-se com criatividade")],
        ],
      },
      {
        type: "choice",
        prompt: t("Routine feels dry. What helps love blossom again?", "A rotina parece seca. O que ajuda o amor a florescer novamente?"),
        options: [
          t("Wait passively for passion", "Esperar passivamente pela paixão"),
          t("Pray, encourage, and do concrete good for the other", "Rezar, encorajar e fazer concretamente o bem ao outro"),
          t("Compare the relationship with others", "Comparar o relacionamento com outros"),
        ],
        correct: 1,
      },
    ],
    quiz: [
      {
        prompt: t("Christians promise fidelity relying on…", "Os cristãos prometem fidelidade confiando…"),
        options: [t("Willpower alone", "Somente na força de vontade"), t("Their effort and God’s grace", "No próprio esforço e na graça de Deus"), t("Permanent excitement", "Num entusiasmo permanente")],
        correct: 1,
      },
      {
        prompt: t("Fidelity is primarily…", "A fidelidade é principalmente…"),
        options: [t("Passive endurance", "Resistência passiva"), t("Active, repeated care", "Cuidado ativo e repetido"), t("Avoiding every disagreement", "Evitar todo desacordo")],
        correct: 1,
      },
      {
        prompt: t("When infatuation changes…", "Quando a paixão muda…"),
        options: [t("Love has necessarily failed", "O amor necessariamente fracassou"), t("Love can mature into deeper communion", "O amor pode amadurecer numa comunhão mais profunda"), t("Nothing can be done", "Nada pode ser feito")],
        correct: 1,
      },
    ],
    saintQuote: {
      text: t("The family that prays together stays together.", "A família que reza unida permanece unida."),
      author: t("Saint Teresa of Calcutta", "Santa Teresa de Calcutá"),
      source: t("Frequently repeated teaching", "Ensinamento frequentemente repetido"),
    },
    reflectionPrompt: t("What daily action makes fidelity visible?", "Que ação diária torna a fidelidade visível?"),
  },
  {
    number: 127,
    deepDive: [
      {
        source: "CCC 1646; Amoris Laetitia 124",
        title: t("Covenant accepts an unknown future", "A aliança aceita um futuro desconhecido"),
        body: t(
          "Marriage cannot remove risk. The spouses freely entrust an unknown future to one another and to God, learning mutual help and service through both joy and suffering.",
          "O matrimônio não pode eliminar o risco. Os esposos confiam livremente um futuro desconhecido um ao outro e a Deus, aprendendo ajuda e serviço mútuos na alegria e no sofrimento.",
        ),
      },
      {
        source: "CIC 1152-1155; Amoris Laetitia 241",
        title: t("Fidelity never requires tolerating danger", "A fidelidade nunca exige tolerar o perigo"),
        body: t(
          "Unconditional love is not denial. Grave danger, violence, or abuse can make separation necessary. Seeking safety and professional help can be a faithful and responsible act, especially where children are concerned.",
          "O amor incondicional não é negação da realidade. Perigo grave, violência ou abuso podem tornar necessária a separação. Buscar segurança e ajuda profissional pode ser um ato fiel e responsável, especialmente quando há filhos.",
        ),
      },
    ],
    games: [
      {
        type: "sequence",
        prompt: t("A serious crisis appears. Put responsible action in order.", "Surge uma crise grave. Coloque a ação responsável na ordem certa."),
        items: [
          { id: "safety", label: t("Protect immediate safety", "Proteger a segurança imediata") },
          { id: "help", label: t("Seek professional and pastoral help", "Buscar ajuda profissional e pastoral") },
          { id: "discern", label: t("Discern faithful next steps", "Discernir os próximos passos fiéis") },
        ],
        answer: ["safety", "help", "discern"],
      },
      {
        type: "match",
        prompt: t("Clarify what fidelity means in crisis.", "Esclareça o que significa fidelidade na crise."),
        pairs: [
          [t("Unconditional love", "Amor incondicional"), t("Not blind denial", "Não é negação cega")],
          [t("Fidelity", "Fidelidade"), t("Does not abandon the person", "Não abandona a pessoa")],
          [t("Separation", "Separação"), t("May protect life and dignity", "Pode proteger a vida e a dignidade")],
        ],
      },
      {
        type: "choice",
        prompt: t("Addiction is joined by violence and danger. What is responsible?", "O vício vem acompanhado de violência e perigo. O que é responsável?"),
        options: [
          t("Hide everything to protect the marriage’s image", "Esconder tudo para proteger a imagem do matrimônio"),
          t("Secure safety and seek qualified help immediately", "Garantir a segurança e buscar ajuda qualificada imediatamente"),
          t("Wait until the danger becomes certain", "Esperar até que o perigo se torne certo"),
        ],
        correct: 1,
      },
    ],
    quiz: [
      {
        prompt: t("Does marriage guarantee an easy future?", "O matrimônio garante um futuro fácil?"),
        options: [t("Yes", "Sim"), t("No; it promises faithful companionship through reality", "Não; ele promete companhia fiel através da realidade"), t("Only with enough planning", "Somente com planejamento suficiente")],
        correct: 1,
      },
      {
        prompt: t("When can separation be necessary?", "Quando a separação pode ser necessária?"),
        options: [t("Whenever feelings weaken", "Sempre que os sentimentos enfraquecem"), t("When life, safety, or dignity is gravely threatened", "Quando a vida, a segurança ou a dignidade estão gravemente ameaçadas"), t("Never", "Nunca")],
        correct: 1,
      },
      {
        prompt: t("What makes the risk of fidelity possible?", "O que torna possível assumir o risco da fidelidade?"),
        options: [t("Knowing every future event", "Conhecer todo acontecimento futuro"), t("A free covenant supported by God and wise help", "Uma aliança livre sustentada por Deus e por ajuda sábia"), t("Ignoring possible problems", "Ignorar possíveis problemas")],
        correct: 1,
      },
    ],
    saintQuote: {
      text: t("Bear one another’s burdens, and so fulfil the law of Christ.", "Carregai os fardos uns dos outros e assim cumprireis a lei de Cristo."),
      author: t("Saint Paul", "São Paulo"),
      source: "Gl 6,2",
    },
    reflectionPrompt: t("How can fidelity and safety remain together during a grave crisis?", "Como a fidelidade e a segurança podem permanecer juntas durante uma crise grave?"),
  },
  {
    number: 140,
    deepDive: [
      {
        source: "1Cor 13,1-13; YOUCAT 8, 193, 263",
        title: t("Love changes without disappearing", "O amor muda sem desaparecer"),
        body: t(
          "Feelings naturally change, but Christian love has a deeper source in God. It can pass from infatuation to a freer, steadier, and more merciful communion.",
          "Os sentimentos mudam naturalmente, mas o amor cristão tem uma fonte mais profunda em Deus. Ele pode passar da paixão para uma comunhão mais livre, firme e misericordiosa.",
        ),
      },
      {
        source: "Amoris Laetitia 89, 90, 133, 135; Jo 15,13",
        title: t("Mature love is practiced", "O amor maduro é praticado"),
        body: t(
          "Lasting love is celebration and ordinary life: attention, gratitude, forgiveness, sacrifice, humor, and shared prayer. These habits allow love to deepen rather than merely repeat its beginning.",
          "O amor duradouro é celebração e vida cotidiana: atenção, gratidão, perdão, sacrifício, humor e oração comum. Esses hábitos permitem que o amor se aprofunde, em vez de apenas repetir o início.",
        ),
      },
    ],
    games: [
      {
        type: "sequence",
        prompt: t("Put the growth of love in order.", "Coloque o crescimento do amor na ordem certa."),
        items: [
          { id: "spark", label: t("First infatuation", "Primeira paixão") },
          { id: "daily", label: t("Daily decision", "Decisão diária") },
          { id: "mature", label: t("Mature communion", "Comunhão madura") },
        ],
        answer: ["spark", "daily", "mature"],
      },
      {
        type: "match",
        prompt: t("Match the moment with love’s response.", "Associe o momento à resposta do amor."),
        pairs: [
          [t("Celebration", "Celebração"), t("Gratitude", "Gratidão")],
          [t("Routine", "Rotina"), t("Attentive care", "Cuidado atento")],
          [t("Crisis", "Crise"), t("Truth and forgiveness", "Verdade e perdão")],
        ],
      },
      {
        type: "choice",
        prompt: t("The emotional intensity is lower. What can this become?", "A intensidade emocional diminuiu. Em que isso pode se transformar?"),
        options: [
          t("Proof that love has ended", "Prova de que o amor acabou"),
          t("An invitation to deeper, freer love", "Um convite a um amor mais profundo e livre"),
          t("A reason to stop making an effort", "Um motivo para deixar de se esforçar"),
        ],
        correct: 1,
      },
    ],
    quiz: [
      {
        prompt: t("Is love identical with feeling?", "O amor é idêntico ao sentimento?"),
        options: [t("Yes", "Sim"), t("No; it is also decision and grace", "Não; ele também é decisão e graça"), t("Only in marriage", "Somente no matrimônio")],
        correct: 1,
      },
      {
        prompt: t("What can happen after infatuation fades?", "O que pode acontecer quando a paixão diminui?"),
        options: [t("Love can mature", "O amor pode amadurecer"), t("Nothing except separation", "Nada além da separação"), t("The relationship becomes meaningless", "O relacionamento perde o sentido")],
        correct: 0,
      },
      {
        prompt: t("Which habit can strengthen lasting love?", "Qual hábito pode fortalecer um amor duradouro?"),
        options: [t("Shared prayer and daily gratitude", "Oração comum e gratidão diária"), t("Avoiding every routine", "Evitar toda rotina"), t("Keeping disappointments secret", "Esconder as decepções")],
        correct: 0,
      },
    ],
    saintQuote: {
      text: t("God is love, and whoever remains in love remains in God and God in him.", "Deus é amor: quem permanece no amor permanece em Deus, e Deus permanece nele."),
      author: t("Saint John", "São João"),
      source: "1Jo 4,16",
    },
    reflectionPrompt: t("How can love become deeper when the first intensity changes?", "Como o amor pode se tornar mais profundo quando a intensidade inicial muda?"),
  },
];

for (const item of learning) {
  if (deepDiveSources[item.number]) item.deepDive = deepDiveSources[item.number];
}

export default learning;
