/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import {GoogleGenAI} from '@google/genai';

interface Flashcard {
  term: string;
  definition: string;
}

// --- DOM Element References ---
const topicInput = document.getElementById('topicInput') as HTMLTextAreaElement;
const generateButton = document.getElementById(
  'generateButton',
) as HTMLButtonElement;
const flashcardsContainer = document.getElementById(
  'flashcardsContainer',
) as HTMLDivElement;
const errorMessage = document.getElementById('errorMessage') as HTMLDivElement;

// New UI elements for Quiz Mode
const mainContent = document.getElementById('mainContent') as HTMLDivElement;
const startQuizButton = document.getElementById(
  'startQuizButton',
) as HTMLButtonElement;
const quizContainer = document.getElementById('quizContainer') as HTMLDivElement;
const quizProgress = document.getElementById(
  'quizProgress',
) as HTMLParagraphElement;
const endQuizButton = document.getElementById('endQuizButton') as HTMLButtonElement;
const quizArea = document.getElementById('quizArea') as HTMLDivElement;
const quizQuestion = document.getElementById('quizQuestion') as HTMLDivElement;
const quizOptions = document.getElementById('quizOptions') as HTMLDivElement;
const nextQuestionButton = document.getElementById(
  'nextQuestionButton',
) as HTMLButtonElement;
const quizResults = document.getElementById('quizResults') as HTMLDivElement;
const quizScore = document.getElementById('quizScore') as HTMLHeadingElement;
const quizMessage = document.getElementById('quizMessage') as HTMLParagraphElement;
const restartQuizButton = document.getElementById(
  'restartQuizButton',
) as HTMLButtonElement;
const returnToFlashcardsButton = document.getElementById(
  'returnToFlashcardsButton',
) as HTMLButtonElement;

// --- State Management ---
let currentFlashcards: Flashcard[] = [];
let shuffledFlashcards: Flashcard[] = [];
let currentQuestionIndex = 0;
let score = 0;
const NUM_CHOICES = 4;

const ai = new GoogleGenAI({apiKey: process.env.API_KEY});

generateButton.addEventListener('click', async () => {
  const topic = topicInput.value.trim();
  // On new generation, hide quiz controls and clear flashcards
  startQuizButton.style.display = 'none';
  flashcardsContainer.textContent = '';

  if (!topic) {
    errorMessage.textContent =
      'Please enter a topic or some terms and definitions.';
    return;
  }

  errorMessage.textContent = 'Generating flashcards...';
  generateButton.disabled = true;

  try {
    const prompt = `Generate a list of flashcards for the topic of "${topic}". Each flashcard should have a term and a concise definition. Format the output as a list of "Term: Definition" pairs, with each pair on a new line. Ensure terms and definitions are distinct and clearly separated by a single colon. Here's an example output:
    Hello: Hola
    Goodbye: Adiós`;
    const result = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });
    const responseText = result?.text ?? '';

    if (responseText) {
      const flashcards: Flashcard[] = responseText
        .split('\n')
        .map((line) => {
          const parts = line.split(':');
          if (parts.length >= 2 && parts[0].trim()) {
            const term = parts[0].trim();
            const definition = parts.slice(1).join(':').trim();
            if (definition) {
              return {term, definition};
            }
          }
          return null;
        })
        .filter((card): card is Flashcard => card !== null);

      if (flashcards.length > 0) {
        errorMessage.textContent = '';
        currentFlashcards = flashcards; // Store for quiz
        flashcards.forEach((flashcard, index) => {
          const cardDiv = document.createElement('div');
          cardDiv.classList.add('flashcard');
          cardDiv.style.animationDelay = `${index * 75}ms`;
          cardDiv.dataset['index'] = index.toString();
          cardDiv.setAttribute('role', 'button');
          cardDiv.setAttribute('tabindex', '0');
          cardDiv.setAttribute('aria-label', `Flashcard ${index + 1}: ${flashcard.term}. Click to see definition.`);


          const cardInner = document.createElement('div');
          cardInner.classList.add('flashcard-inner');

          const cardFront = document.createElement('div');
          cardFront.classList.add('flashcard-front');
          const termDiv = document.createElement('div');
          termDiv.classList.add('term');
          termDiv.textContent = flashcard.term;
          cardFront.appendChild(termDiv);

          const cardBack = document.createElement('div');
          cardBack.classList.add('flashcard-back');
          const definitionDiv = document.createElement('div');
          definitionDiv.classList.add('definition');
          definitionDiv.textContent = flashcard.definition;
          cardBack.appendChild(definitionDiv);

          cardInner.appendChild(cardFront);
          cardInner.appendChild(cardBack);
          cardDiv.appendChild(cardInner);

          flashcardsContainer.appendChild(cardDiv);

          cardDiv.addEventListener('click', () => {
            cardDiv.classList.toggle('flipped');
          });
        });

        // Show quiz button if enough cards are generated
        if (flashcards.length >= NUM_CHOICES) {
          startQuizButton.style.display = 'block';
        } else {
          errorMessage.textContent = `Please generate at least ${NUM_CHOICES} flashcards to start the quiz.`;
        }
      } else {
        errorMessage.textContent =
          'No valid flashcards could be generated. Please try a different topic.';
      }
    } else {
      errorMessage.textContent = 'Received an empty response. Please try again.';
    }
  } catch (error: unknown) {
    console.error('Error generating content:', error);
    const detailedError =
      (error as Error)?.message || 'An unknown error occurred';
    errorMessage.textContent = `An error occurred: ${detailedError}`;
  } finally {
    generateButton.disabled = false;
  }
});

// --- Quiz Mode Functions ---
function startQuiz() {
  mainContent.style.display = 'none';
  flashcardsContainer.style.display = 'none';
  startQuizButton.style.display = 'none';
  quizContainer.style.display = 'block';
  quizArea.style.display = 'block';
  quizResults.style.display = 'none';

  score = 0;
  currentQuestionIndex = 0;
  shuffledFlashcards = [...currentFlashcards].sort(() => Math.random() - 0.5);

  displayQuestion();
}

function displayQuestion() {
  if (currentQuestionIndex >= shuffledFlashcards.length) {
    showResults();
    return;
  }

  quizOptions.innerHTML = '';
  nextQuestionButton.style.display = 'none';

  quizProgress.textContent = `Question ${currentQuestionIndex + 1} of ${
    shuffledFlashcards.length
  }`;

  const currentCard = shuffledFlashcards[currentQuestionIndex];
  quizQuestion.textContent = currentCard.definition;

  const correctAnswer = currentCard.term;
  const choices = new Set<string>([correctAnswer]);
  const incorrectAnswers = shuffledFlashcards
    .filter((card) => card.term !== correctAnswer)
    .map((card) => card.term);
  
  incorrectAnswers.sort(() => Math.random() - 0.5);

  for (const answer of incorrectAnswers) {
    if (choices.size < NUM_CHOICES) {
      choices.add(answer);
    }
  }

  const shuffledChoices = Array.from(choices).sort(() => Math.random() - 0.5);

  shuffledChoices.forEach((choice) => {
    const button = document.createElement('button');
    button.textContent = choice;
    button.classList.add('quiz-option-button');
    button.addEventListener('click', () =>
      checkAnswer(choice, correctAnswer, button),
    );
    quizOptions.appendChild(button);
  });
}

function checkAnswer(
  selectedAnswer: string,
  correctAnswer: string,
  buttonEl: HTMLButtonElement,
) {
  Array.from(quizOptions.children).forEach((button) => {
    const btn = button as HTMLButtonElement;
    btn.disabled = true;
    if (btn.textContent === correctAnswer) {
      btn.classList.add('correct');
    } else if (btn === buttonEl) {
      btn.classList.add('incorrect');
    }
  });

  if (selectedAnswer === correctAnswer) {
    score++;
  }
  nextQuestionButton.style.display = 'block';
}

function showResults() {
  quizArea.style.display = 'none';
  quizResults.style.display = 'block';

  const percentage = Math.round((score / shuffledFlashcards.length) * 100);
  quizScore.textContent = `${percentage}%`;
  quizMessage.textContent = `You answered ${score} out of ${shuffledFlashcards.length} questions correctly.`;
}

function endQuiz() {
  mainContent.style.display = 'block';
  flashcardsContainer.style.display = 'flex';
  if (currentFlashcards.length >= NUM_CHOICES) {
    startQuizButton.style.display = 'block';
  }
  quizContainer.style.display = 'none';
}

// --- New Event Listeners for Quiz Mode ---
startQuizButton.addEventListener('click', startQuiz);
nextQuestionButton.addEventListener('click', () => {
  currentQuestionIndex++;
  displayQuestion();
});
restartQuizButton.addEventListener('click', startQuiz);
endQuizButton.addEventListener('click', endQuiz);
returnToFlashcardsButton.addEventListener('click', endQuiz);