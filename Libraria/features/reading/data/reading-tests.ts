export type IELTSQuestionType =
  | "multiple-choice"
  | "true-false-not-given"
  | "yes-no-not-given"
  | "matching-headings"
  | "sentence-completion"
  | "summary-completion";

export type ReadingQuestion = {
  prompt: string;
  options: string[];
  answer: number | string;
  explanation: string;
  type?: IELTSQuestionType;
  passageIndex?: number;
};

export type ReadingQuestionGroup = {
  startQuestion: number;
  endQuestion: number;
  instructions: string;
};

export type ReadingPassage = { title: string; text: string; difficulty?: string; section?: number };
export type ReadingFlashcard = { term: string; meaning: string; example?: string; kind: "vocabulary" | "collocation" };

export function getReadingParagraphs(passage: ReadingPassage) {
  return passage.text.split(/\n+/).filter(Boolean).filter((paragraph, index) => !(index === 0 && paragraph.trim() === passage.title.trim()));
}

export type ReadingTest = {
  id: string;
  status?: "draft" | "published";
  timedExam?: boolean;
  title: string;
  topic: string;
  minutes: number;
  passage: string;
  passages?: ReadingPassage[];
  questions: ReadingQuestion[];
  questionGroups?: ReadingQuestionGroup[];
  questionNumberStart?: number;
  phase?: 1 | 2 | 3 | 4;
  kind?: "reading" | "ielts" | "exam" | "vocabulary" | "quiz";
  flashcards?: ReadingFlashcard[];
  scoreRelease?: "immediate" | "teacher_review";
  visibility?: "all" | "students" | "groups";
  studentIds?: string[];
  studentId?: string;
  groupNames?: string[];
  opensAt?: string;
  closesAt?: string;
};

const volcanoPassage = `Scientists Are Mapping the World's Largest Volcano

(A) After 36 days of battling sharks that kept biting their equipment, scientists have returned from the remote Pacific Ocean with a new way of looking at the world’s largest - and possibly most mysterious - volcano, Tamu Massif.

(B) The team has begun making 3-D maps that offer the clearest look yet at the underwater mountain, which covers an area the size of New Mexico. In the coming months, the maps will be refined and the data analyzed, with the ultimate goal of figuring out how the mountain was formed.

(C) It's possible that the western edge of Tamu Massif is actually a separate mountain that formed at a different time, says William Sager, a geologist at the University of Houston who led the expedition. That would explain some differences between the western part of the mountain and the main body.

(D) The team also found that the massif (as such a massive mountain is known) is highly pockmarked with craters and cliffs. Magnetic analysis provides some insight into the mountain’s genesis, suggesting that part of it formed through steady releases of lava along the intersection of three mid-ocean ridges, while part of it is harder to explain. A working theory is that a large plume of hot mantle rock may have contributed additional heat and material, a fairly novel idea.

(E) Tamu Massif lies about 1,000 miles (1,600 kilometers) east of Japan. It is a rounded dome, or shield volcano, measuring 280 by 400 miles (450 by 650 kilometers). Its top lies more than a mile (about 2,000 meters) below the ocean surface and is 50 times larger than the biggest active volcano on Earth, Hawaii’s Mauna Loa. Sager published a paper in 2013 that said the main rise of Tamu Massif is most likely a single volcano, instead of a complex of multiple volcanoes that smashed together. But he couldn’t explain how something so big formed.

(F) The team used sonar and magnetometers (which measure magnetic fields) to map more than a million square kilometers of the ocean floor in great detail. Sager and students teamed up with Masao Nakanishi of Japan’s Chiba University, with Sager receiving funding support from the National Geographic Society and the Schmidt Ocean Institute.

(G) Since sharks are attracted to magnetic fields, the toothy fish “were all over our magnetometer, and it got pretty chomped up,” says Sager. When the team replaced the device with a spare, that unit was nearly ripped off by more sharks. The magnetic field research suggests the mountain formed relatively quickly, sometime around 145 million years ago. Part of the volcano sports magnetic "stripes," or bands with different magnetic properties, suggesting that lava flowed out evenly from the mid-ocean ridges over time and changed in polarity each time Earth's magnetic field reversed direction. The central part of the peak is more jumbled, so it may have formed more quickly or through a different process.

(H) Sager isn’t sure what caused the magnetic anomalies yet, but suspects more complex forces were at work than simply eruptions from the ridges. It’s possible a deep plume of hot rock from the mantle also contributed to the volcano’s formation, he says. Sager hopes the analysis will also help explain about a dozen other similar features on the ocean floor, as well as add to the overall understanding of plate tectonics.`;

const hivPassage = `It is easy to see why AIDS seemed so mysterious and frightening when US medics first encountered it 35 years ago. The condition robbed young, healthy people of their strong immune system, leaving them weak and vulnerable. And it seemed to come out of nowhere.

Today we know much more how and why HIV – the virus that leads to AIDS – has become a global pandemic. Unsurprisingly, sex workers unwittingly played a part. But no less important were the roles of trade, the collapse of colonialism, and 20th Century sociopolitical reform.

HIV did not really appear out of nowhere, of course. It probably began as a virus affecting monkeys and apes in west central Africa.

From there it jumped species into humans on several occasions, perhaps because people ate infected bushmeat. Some people carry a version of HIV closely related to that seen in sooty mangabey monkeys, for instance. But HIV that came from monkeys has not become a global problem.

We are more closely related to apes, like gorillas and chimpanzees, than we are to monkeys. But even when HIV has passed into human populations from these apes, it has not necessarily turned into a widespread health issue.

HIV originating from apes typically belongs to a type of virus called HIV-1. One is called HIV-1 group O, and human cases are largely confined to west Africa.

In fact, only one form of HIV has spread far and wide after jumping to humans. This version, which probably originated from chimpanzees, is called HIV-1 group M (for "major"). More than 90% of HIV infections belong in group M. Which raises an obvious question: what's so special about HIV-1 group M?

A study published in 2014 suggests a surprising answer: there might be nothing particularly special about group M.

It is not especially infectious, as you might expect. Instead, it seems that this form of HIV simply took advantage of events. "Ecological rather than evolutionary factors drove its rapid spread," says Nuno Faria at the University of Oxford in the UK.

Faria and his colleagues built a family tree of HIV, by looking at a diverse array of HIV genomes collected from about 800 infected people from central Africa.

Genomes pick up new mutations at a fairly steady rate, so by comparing two genome sequences and counting the differences they could work out when the two last shared a common ancestor. This technique is widely used, for example to establish that our common ancestor with chimpanzees lived at least 7 million years ago.

"RNA viruses such as HIV evolve approximately 1 million times faster than human DNA," says Faria. This means the HIV "molecular clock" ticks very fast indeed.

It ticks so fast, Faria and his colleagues found that the HIV genomes all shared a common ancestor that existed no more than 100 years ago. The HIV-1 group M pandemic probably first began in the 1920s.

Then the team went further. Because they knew where each of the HIV samples had been collected, they could place the origin of the pandemic in a specific city: Kinshasa, now the capital of the Democratic Republic of Congo.

At this point, the researchers changed tack. They turned to historical records to work out why HIV infections in an African city in the 1920s could ultimately spark a pandemic.

A likely sequence of events quickly became obvious. In the 1920s, DR Congo was a Belgian colony and Kinshasa – then known as Leopoldville – had just been made the capital. The city became a very attractive destination for young working men seeking their fortunes, and for sex workers only too willing to help them spend their earnings. The virus spread quickly through the population.

It did not remain confined to the city. The researchers discovered that the capital of the Belgian Congo was, in the 1920s, one of the best connected cities in Africa. Taking full advantage of an extensive rail network used by hundreds of thousands of people each year, the virus spread to cities 900 miles (1500km) away in just 20 years.

Everything was in place for an explosion in infection rates in the 1960s. The beginning of that decade brought another change.

Belgian Congo gained its independence, and became an attractive source of employment to French speakers elsewhere in the world, including Haiti. When these young Haitians returned home a few years later they took a particular form of HIV-1 group M, called "subtype B", to the western side of the Atlantic.

It arrived in the US in the 1970s, just as sexual liberation and homophobic attitudes were leading to concentrations of gay men in cosmopolitan cities like New York and San Francisco. Once more, HIV took advantage of the sociopolitical situation to spread quickly through the US and Europe.

"There is no reason to believe that other subtypes would not have spread as quickly as subtype B, given similar ecological circumstances," says Faria.

For instance, in 2015 there was an outbreak in the US state of Indiana, associated with drug injecting.

The US Centers for Disease Control and Prevention has been analyzing the HIV genome sequences and data about location and time of infection, says Yonatan Grad at the Harvard School of Public Health in Boston, Massachusetts. "These data help to understand the extent of the outbreak, and will further help to understand when public health interventions have worked."

This approach can work for other pathogens. In 2014, Grad and his colleague Marc Lipsitch published an investigation into the spread of drug-resistant gonorrhoea across the US.

"Because we had representative sequences from individuals in different cities at different times and with different sexual orientations, we could show the spread was from the west of the country to the east," says Lipsitch.

What's more, they could confirm that the drug-resistant form of gonorrhoea appeared to have circulated predominantly in men who have sex with men. That could prompt increased screening in these at-risk populations, in an effort to reduce further spread.

In other words, there is real power to studying pathogens like HIV and gonorrhoea through the prism of human society.`;

const penguinPassage = `Scientists studying penguins’ feathers have revealed how the birds stay ice free when hopping in and out of below zero waters in the Antarctic. A combination of nano-sized pores and an extra water repelling preening oil the birds secrete is thought to give Antarctic penguins’ feathers superhydrophobic properties. Researchers in the US made the discovery using Scanning Electron Microscopy (SEM) to study penguin feathers in extreme detail. Antarctic penguins live in one of Earth’s most extreme environments, facing temperatures that drop to -40C, winds with speeds of 40 metres per second and water that stays around -2.2C. But even in these sub-zero conditions, the birds manage to prevent ice from coating their feathers.

“They are an amazing species, living in extreme conditions, and great swimmers. Basically they are living engineering marvels,” says research team member Dr Pirouz Kavehpour, professor of Mechanical and Aerospace Engineering at the University of California, Los Angeles (UCLA). Birds’ feathers are known to have hydrophobic, or non-wetting, properties. But scientists from UCLA, University of Massachusetts Amherst and SeaWorld, wanted to know what makes Antarctic penguins’ feathers extra ice repelling.

“What we learn here is how penguins combine oil and nano-structures on the feathers to produce this effect to perfection,” explains Kavehpour. By analysing feathers from different penguin species, the researchers discovered Antarctic species the gentoo penguin (Pygoscelis papua) was more superhydrophobic compared with a species found in warmer climes – the Magellanic penguin (Spheniscus magellanicus) – whose breeding sites include Argentinian desert.

Gentoo penguins’ feathers contained tiny pores which trapped air, making the surface hydrophobic. And they were smothered with a special preening oil, produced by a gland near the base of the tail, with which the birds cover themselves. Together, these properties mean that in the wild, droplets of water on Antarctic penguins’ superhydrophobic feathers bead up on the surface like spheres – formations that, according to the team, could provide geometry that delays ice formation, since heat cannot easily flow out of the water if the droplet only has minimal contact with the surface of the feather.

“The shape of the droplet on the surface dictates the delay in freezing,” explains Kavehpour. The water droplets roll off the penguin's feathers before they have time to freeze, the researchers propose. Penguins living in the Antarctic are highly evolved to cope with harsh conditions: their short outer feathers overlap to make a thick protective layer over fluffier feathers which keep them warm. Under their skin, a thick layer of fat keeps them insulated. The flightless birds spend a lot of time in the sea and are extremely agile and graceful swimmers, appearing much more awkward on land.

Kavehpour was inspired to study Antarctic penguins’ feathers after watching the birds in a nature documentary: “I saw these birds moving in and out of water, splashing everywhere. Yet there is no single drop of frozen ice sticking to them,” he tells BBC Earth. His team now hopes its work could aid design of better man-made surfaces which minimise frost formation.

“I would love to see biomimicking of these surfaces for important applications, for example, de-icing of aircrafts,” says Kavehpour. Currently, airlines spend a lot of time and money using chemical de-icers on aeroplanes, as ice can alter the vehicles’ aerodynamic properties and can even cause them to crash.`;

const paragraphLetters = ["A", "B", "C", "D", "E", "F", "G", "H"];
const paragraphQuestions = [
  ["Possible explanation of the differences between parts of the mountain", "C"],
  ["Size data", "E"],
  ["A new way of looking", "A"],
  ["Problem with sharks", "G"],
  ["Uncertainty of the anomalies", "H"],
  ["Equipment which measures magnetic fields", "F"],
  ["The start of making maps", "B"],
  ["A working theory", "D"],
] as const;

const volcanoQuestions: ReadingQuestion[] = [
  ...paragraphQuestions.map(([prompt, answer]) => ({
    prompt,
    options: paragraphLetters,
    answer,
    type: "matching-headings" as const,
    explanation: `This information appears in paragraph ${answer}.`,
  })),
  { prompt: "A large plume of ___ may have contributed additional heat and material.", options: [], answer: "hot mantle", type: "sentence-completion", explanation: "Paragraph D describes a plume of hot mantle rock." },
  { prompt: "Tamu Massif is a ___, or shield volcano.", options: [], answer: "rounded dome", type: "sentence-completion", explanation: "Paragraph E calls it a rounded dome, or shield volcano." },
  { prompt: "When the team replaced the device with a ___, that unit was nearly ripped off by more sharks.", options: [], answer: "spare", type: "sentence-completion", explanation: "Paragraph G says the team replaced it with a spare." },
  { prompt: "Sager believes the magnetic anomalies were caused by something more than ___ from the ridges.", options: [], answer: "simply eruptions", type: "sentence-completion", explanation: "Paragraph H says the forces were more complex than simply eruptions from the ridges." },
];

const hivStatements = [
  ["AIDS was first encountered by US medics 35 years ago.", "TRUE", "The passage says US medics first encountered it 35 years ago."],
  ["Sex workers played the most important role in the development of the AIDS pandemic.", "FALSE", "The passage says trade, colonial change, and sociopolitical reform were no less important."],
  ["It is believed that HIV appeared out of nowhere.", "FALSE", "The passage says HIV did not really appear out of nowhere."],
  ["Humans are not closely related to monkeys.", "TRUE", "The passage says humans are more closely related to apes than to monkeys."],
  ["HIV-1 group O originated in the 1920s.", "NOT GIVEN", "The passage gives no origin date for group O."],
  ["HIV-1 group M has something special that explains its spread.", "FALSE", "The study suggests there might be nothing particularly special about group M."],
  ["Human DNA evolves approximately 1 million times slower than HIV.", "TRUE", "The passage says HIV RNA viruses evolve about one million times faster than human DNA."],
  ["Scientists believe that HIV already existed in the 1920s.", "TRUE", "The group M pandemic probably began in the 1920s."],
] as const;

const hivCompletions = [
  ["Scientists can place the origin of ___ in a specific city.", "the pandemic", "The origin of the pandemic was placed in Kinshasa."],
  ["Kinshasa was a very ___ for young working men seeking their fortunes.", "attractive destination", "The passage calls the city an attractive destination."],
  ["In just 20 years the virus managed to ___ to cities 900 miles away.", "spread", "It spread to distant cities via the rail network."],
  ["Belgian Congo became an attractive source of employment to French speakers when it gained ___. ", "its independence", "The passage links this change to independence."],
  ["HIV spread quickly through the US and Europe because of the ___. ", "sociopolitical situation", "The passage says HIV took advantage of the sociopolitical situation."],
  ["The outbreak in Indiana was associated with ___. ", "drug injecting", "The passage explicitly links the outbreak with drug injecting."],
  ["The same approach as for HIV can work for ___. ", "other pathogens", "The passage says this approach can work for other pathogens."],
  ["Drug-resistant gonorrhoea appeared to have ___ in men who have sex with men.", "circulated predominantly", "The passage says it circulated predominantly in this group."],
] as const;

export const readingTests: ReadingTest[] = [
  {
    id: "ielts-reading-test-1",
    title: "IELTS Reading Test 1",
    topic: "Academic Reading · 3 sections",
    minutes: 60,
    passage: [volcanoPassage, hivPassage, penguinPassage].join("\n\n"),
    passages: [
      { title: "Scientists Are Mapping the World's Largest Volcano", text: volcanoPassage, section: 1 },
      { title: "We Know the City Where HIV First Emerged", text: hivPassage, section: 2 },
      { title: "Scientists studying penguins’ feathers", text: penguinPassage, section: 3 },
    ],
    questions: [
      ...volcanoQuestions,
      ...hivStatements.map(([prompt, answer, explanation]) => ({
        prompt,
        options: ["TRUE", "FALSE", "NOT GIVEN"],
        answer,
        type: "true-false-not-given" as const,
        explanation,
      })),
      ...hivCompletions.map(([prompt, answer, explanation]) => ({
        prompt,
        options: [],
        answer,
        type: "sentence-completion" as const,
        explanation,
      })),
      { prompt: "Penguins stay ice free due to:", options: ["Nano-sized pores", "An extra water-repelling preening oil", "A combination of nano-sized pores and an extra water-repelling preening oil", "A combination of various factors"], answer: 2, type: "multiple-choice", explanation: "The passage says both nano-sized pores and preening oil create the superhydrophobic effect." },
      { prompt: "Antarctic penguins experience extreme weather conditions, including:", options: ["Low temperatures that can drop to -40°C", "Severe winds up to 40 metres per second", "Below-zero water temperatures", "All of the above"], answer: 3, type: "multiple-choice", explanation: "The passage lists all three extreme conditions." },
      { prompt: "In the passage, ‘engineering marvels’ means penguins:", options: ["Are very intelligent", "Are good swimmers", "Are well prepared to live in severe conditions", "Are both good swimmers and well prepared for severe conditions"], answer: 3, type: "multiple-choice", explanation: "The quote describes their swimming and their ability to live in extreme conditions." },
      { prompt: "Penguin feathers have everything below, EXCEPT:", options: ["Hydrophobic properties", "Extra ice-repelling properties", "Soft structures", "Oil structures"], answer: 2, type: "multiple-choice", explanation: "The passage mentions hydrophobic feathers, extra ice-repelling properties, and preening oil, but not soft structures." },
      { prompt: "The gentoo penguin:", options: ["Is less superhydrophobic than the Magellanic penguin", "Has feathers that contain tiny pores", "Cannot swim", "Lives in the Argentinian desert"], answer: 1, type: "multiple-choice", explanation: "The passage says gentoo penguin feathers contain tiny pores." },
      { prompt: "Formations like ___ could provide geometry that delays ice formation.", options: [], answer: "spheres", type: "sentence-completion", explanation: "Water droplets bead up like spheres on the feathers." },
      { prompt: "The delay in freezing is dictated by the ___ of the droplet.", options: [], answer: "shape", type: "sentence-completion", explanation: "Kavehpour says the droplet’s shape dictates the delay." },
      { prompt: "Penguins in the Antarctic are highly evolved to cope with ___ conditions.", options: [], answer: "harsh", type: "sentence-completion", explanation: "The passage describes their adaptation to harsh conditions." },
      { prompt: "Penguins are insulated by a ___ layer of fat.", options: [], answer: "thick", type: "sentence-completion", explanation: "A thick layer of fat keeps them insulated." },
      { prompt: "On land, penguins appear much more ___ than in the sea.", options: [], answer: "awkward", type: "sentence-completion", explanation: "The passage says they appear more awkward on land." },
      { prompt: "Kavehpour was inspired after watching a ___ about penguins.", options: [], answer: "documentary", type: "sentence-completion", explanation: "He was inspired by a nature documentary." },
      { prompt: "Kavehpour would like to see ___ of these surfaces for important applications.", options: [], answer: "biomimicking", type: "sentence-completion", explanation: "He hopes for biomimicking of these surfaces." },
    ],
    phase: 1,
    kind: "ielts",
  },
];
