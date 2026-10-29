export type Choice = { text: string; imageSrc?: string };
export type Exercise = {
  type: "SELECT" | "ASSIST";
  question: string;
  answer: string;
  choices: [Choice, Choice, Choice];
};
export type LessonSeed = { title: string; exercises: Exercise[]; reading: string };
export type UnitSeed = { title: string; description: string; lessons: LessonSeed[] };

const words = (
  answer: string,
  wrongOne: string,
  wrongTwo: string,
): [Choice, Choice, Choice] => [
  { text: answer },
  { text: wrongOne },
  { text: wrongTwo },
];
const pictureWords = (
  answer: string,
  imageSrc: string,
  wrongOne: string,
  wrongTwo: string,
): [Choice, Choice, Choice] => [
  { text: answer, imageSrc },
  { text: wrongOne },
  { text: wrongTwo },
];

export const englishCurriculum: UnitSeed[] = [
  {
    title: "English foundations",
    description: "Start speaking with greetings, useful words, and clear sentences.",
    lessons: [
      {
        title: "Greetings & introductions",
        reading: "It is a bright Monday morning. Alex walks into a small bookshop and sees Mia near the door. “Good morning,” Alex says with a smile. Mia smiles back. “Good morning! How are you?” “I’m good, thanks. My name is Alex,” Alex replies. Mia introduces herself too. They talk about the books they like and discover they both enjoy stories about travel. Before they leave, Alex says, “Nice to meet you.” “Nice to meet you, too,” says Mia. A simple greeting helps two people begin a friendly conversation.",
        exercises: [
          { type: "ASSIST", question: "Choose a friendly greeting for the morning.", answer: "Good morning!", choices: words("Good morning!", "Good night!", "Goodbye!") },
          { type: "ASSIST", question: "Complete the introduction: My ___ is Alex.", answer: "name", choices: words("name", "names", "named") },
          { type: "ASSIST", question: "Someone says, ‘How are you?’ Choose a natural reply.", answer: "I'm good, thanks.", choices: words("I'm good, thanks.", "I good thanks.", "Good you are?") },
          { type: "ASSIST", question: "Choose the polite way to meet someone.", answer: "Nice to meet you.", choices: words("Nice to meet you.", "Meet nice you.", "You nice meet.") },
        ],
      },
      {
        title: "People & pronouns",
        reading: "Mia is a student. She has a friend named Tom, and he lives near her school. Tom and Mia study English together. They read short stories after class and help each other with new words. When Mia does not understand a sentence, Tom explains it. When Tom forgets a word, Mia gives him a clue. They are good friends, and they learn as a team. In English, we can use “she” for Mia, “he” for Tom, and “they” for both friends. We can say, “They study together.”",
        exercises: [
          { type: "SELECT", question: "Choose the word for this person.", answer: "man", choices: pictureWords("man", "/man.svg", "book", "house") },
          { type: "SELECT", question: "Choose the word for this person.", answer: "woman", choices: pictureWords("woman", "/woman.svg", "school", "apple") },
          { type: "ASSIST", question: "Mia is my friend. ___ is kind.", answer: "She", choices: words("She", "He", "They") },
          { type: "ASSIST", question: "Tom and I are students. ___ study English.", answer: "We", choices: words("We", "They", "He") },
        ],
      },
      {
        title: "Everyday words",
        reading: "On Saturday, Leo visits a little school library with his sister. Each student can borrow a book. Leo chooses a book about animals, and his sister picks a story about space. They sit by a large window and read quietly. On the table, there is an apple and a glass of water. The library has many boxes of books, sorted by subject. One box holds stories about nature. The children return their books before they go home. They plan to visit the library again next week.",
        exercises: [
          { type: "ASSIST", question: "Choose the word for something you read.", answer: "book", choices: words("book", "chair", "window") },
          { type: "ASSIST", question: "Choose the word for a place where students learn.", answer: "school", choices: words("school", "kitchen", "garden") },
          { type: "ASSIST", question: "Choose the correct plural of ‘box’.", answer: "boxes", choices: words("boxes", "boxs", "boxies") },
          { type: "ASSIST", question: "Choose the correct article: ___ apple.", answer: "an", choices: words("an", "a", "the an") },
        ],
      },
      {
        title: "Numbers & time",
        reading: "Nina has a busy day. She gets up at seven o’clock and eats breakfast. At eight o’clock, she walks to class. She studies for three hours, then meets a friend for lunch. There are seven days in a week, and Nina goes to class five days. On Friday, she finishes early. She reads at home for forty minutes and calls her brother at six o’clock. At night, Nina checks her calendar for tomorrow. Knowing the time helps her plan the day without rushing.",
        exercises: [
          { type: "ASSIST", question: "What number comes after nineteen?", answer: "twenty", choices: words("twenty", "twelve", "thirty") },
          { type: "ASSIST", question: "Choose the correct time phrase: 7:00.", answer: "seven o'clock", choices: words("seven o'clock", "seven hours", "seven time") },
          { type: "ASSIST", question: "Complete: There are ___ days in a week.", answer: "seven", choices: words("seven", "six", "eight") },
          { type: "ASSIST", question: "Choose the correct spelling.", answer: "forty", choices: words("forty", "fourty", "fortee") },
        ],
      },
      {
        title: "Simple present",
        reading: "Sam studies English every morning. He reads one page, writes a few new words, and listens to a short story. His sister goes to school by bus. She does not drink coffee, but she likes tea. In the evening, Sam and his sister talk about music. “Do you like jazz?” he asks. “Yes, I do,” she says. They often listen to a song together after dinner. These are routines: things they do regularly. We use the simple present to talk about habits and facts.",
        exercises: [
          { type: "ASSIST", question: "I ___ English every day.", answer: "study", choices: words("study", "studies", "studying") },
          { type: "ASSIST", question: "She ___ to school by bus.", answer: "goes", choices: words("goes", "go", "going") },
          { type: "ASSIST", question: "Choose the correct negative: He ___ coffee.", answer: "doesn't drink", choices: words("doesn't drink", "don't drinks", "doesn't drinks") },
          { type: "ASSIST", question: "Choose the correct question.", answer: "Do you like music?", choices: words("Do you like music?", "You do like music?", "Does you like music?") },
        ],
      },
    ],
  },
  {
    title: "Everyday English",
    description: "Ask questions, describe your world, and talk about past and present.",
    lessons: [
      {
        title: "Questions & answers",
        reading: "At a new class, the teacher welcomes everyone. “What is your name?” she asks. “I’m Arun,” a student answers. “Where do you live?” “I live near the river.” The teacher asks another student, “How old are you?” “I’m twelve.” Then she asks, “Are you ready to read?” The class answers, “Yes, we are!” Questions help people learn useful information. Words like what, where, and how often begin questions. A short answer can be simple and complete: “Yes, I am” or “No, I’m not.”",
        exercises: [
          { type: "ASSIST", question: "___ is your name?", answer: "What", choices: words("What", "Where", "When") },
          { type: "ASSIST", question: "___ do you live? — In Bangkok.", answer: "Where", choices: words("Where", "Who", "Why") },
          { type: "ASSIST", question: "Choose the natural short answer: ‘Are you ready?’", answer: "Yes, I am.", choices: words("Yes, I am.", "Yes, I do.", "Yes, I ready.") },
          { type: "ASSIST", question: "Choose the correct question word: ___ old are you?", answer: "How", choices: words("How", "What", "Which") },
        ],
      },
      {
        title: "Describing people & places",
        reading: "A boy and a girl walk through a beautiful garden. The garden is large, with a quiet path beside a pond. Bright flowers grow near the trees. The boy carries a small blue bag, while the girl holds a book. They stop at a wooden bench and watch birds in the branches. The place feels calm even though the city is close by. Describing words help a reader picture a person or place. We can say a garden is beautiful, a bag is small, or a path is quiet.",
        exercises: [
          { type: "SELECT", question: "Choose the word for this person.", answer: "girl", choices: pictureWords("girl", "/girl.svg", "table", "city") },
          { type: "SELECT", question: "Choose the word for this person.", answer: "boy", choices: pictureWords("boy", "/boy.svg", "teacher", "park") },
          { type: "ASSIST", question: "The opposite of ‘small’ is ___.", answer: "large", choices: words("large", "short", "quiet") },
          { type: "ASSIST", question: "Choose the adjective: The garden is ___.", answer: "beautiful", choices: words("beautiful", "beauty", "beautifully") },
        ],
      },
      {
        title: "Actions happening now",
        reading: "It is six o’clock, and the family is getting ready for dinner. Dad is making soup in the kitchen. Ana is setting the table while her brother is writing a message to their grandmother. Outside, rain is falling softly. Their dog is sleeping beside the door. “What are you reading?” Ana asks her brother. He shows her a book about the ocean. The family is doing different things right now. We use “am,” “is,” or “are” with an -ing verb to describe an action happening at this moment.",
        exercises: [
          { type: "ASSIST", question: "They ___ dinner right now.", answer: "are making", choices: words("are making", "make", "makes") },
          { type: "ASSIST", question: "I ___ a book at the moment.", answer: "am reading", choices: words("am reading", "read", "reads") },
          { type: "ASSIST", question: "Choose the correct sentence.", answer: "She is listening to music.", choices: words("She is listening to music.", "She listening music.", "She are listening to music.") },
          { type: "ASSIST", question: "Choose the -ing form of ‘write’.", answer: "writing", choices: words("writing", "writeing", "writting") },
        ],
      },
      {
        title: "Talking about the past",
        reading: "Last weekend, Jo visited her cousin in another town. They walked to a small park and watched a film at home later that evening. On Sunday, they went to the market and bought fresh fruit. Jo called her mother before she left. The trip was short, but she enjoyed every part of it. These events happened in the past. Many verbs add -ed, like “visited” and “watched.” Some verbs change in a different way: “go” becomes “went.” Time words such as yesterday and last weekend tell us when something happened.",
        exercises: [
          { type: "ASSIST", question: "Yesterday, we ___ a film.", answer: "watched", choices: words("watched", "watch", "watching") },
          { type: "ASSIST", question: "Choose the past form of ‘go’.", answer: "went", choices: words("went", "goed", "gone") },
          { type: "ASSIST", question: "She ___ her friend last weekend.", answer: "visited", choices: words("visited", "visit", "visits") },
          { type: "ASSIST", question: "Choose the correct question about yesterday.", answer: "Did you call me?", choices: words("Did you call me?", "Did you called me?", "Do you called me?") },
        ],
      },
      {
        title: "Useful everyday conversations",
        reading: "After class, Ben stops at a café. “Could I have a tea, please?” he asks. The server brings a cup and smiles. Ben is not sure what the server said about the cake, so he asks, “Could you say that again, please?” The server repeats the choices slowly. Ben orders a slice of apple cake. When it arrives, he says, “Thank you.” “You’re welcome,” the server replies. Ben finishes his snack and says, “See you soon!” Polite phrases make everyday conversations friendly and clear.",
        exercises: [
          { type: "ASSIST", question: "At a café: ‘___ I have a tea, please?’", answer: "Could", choices: words("Could", "Am", "Have") },
          { type: "ASSIST", question: "Choose a polite way to ask someone to repeat.", answer: "Could you say that again, please?", choices: words("Could you say that again, please?", "Say again you.", "What you said?") },
          { type: "ASSIST", question: "Someone says, ‘Thank you.’ Choose a natural reply.", answer: "You're welcome.", choices: words("You're welcome.", "You welcome are.", "Thank welcome.") },
          { type: "ASSIST", question: "Choose a friendly way to end a conversation.", answer: "See you soon!", choices: words("See you soon!", "How are you?", "Good morning!") },
        ],
      },
    ],
  },
];
