import React from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Animated,
  ScrollView,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { COLORS } from "../theme";

const SAVE = "#4ade80";
const SKIP = "#f87171";

export interface QuizGame {
  question: string;
  options: string[];
  answer: number;
  explanation: string;
}
export interface WordScrambleGame {
  word: string;
  scrambled: string;
  hint: string;
}
export interface FillBlankGame {
  sentence: string;
  answer: string;
  hint: string;
}
export type GameData = QuizGame | WordScrambleGame | FillBlankGame;

interface Props {
  gameType: string;
  gameData: GameData;
  onComplete: (correct: boolean) => void;
  onSkip: () => void;
}

// ── Quiz View ──
const QuizView: React.FC<{
  game: QuizGame;
  onComplete: (correct: boolean) => void;
}> = ({ game, onComplete }) => {
  const [selected, setSelected] = React.useState<number | null>(null);
  const [submitted, setSubmitted] = React.useState(false);
  const correct = selected === game.answer;

  const handleSelect = (idx: number) => {
    if (submitted) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelected(idx);
  };
  const handleSubmit = () => {
    if (selected === null) return;
    setSubmitted(true);
    Haptics.notificationAsync(
      correct
        ? Haptics.NotificationFeedbackType.Success
        : Haptics.NotificationFeedbackType.Error,
    );
    setTimeout(() => onComplete(correct), 1400);
  };

  return (
    <View style={styles.gameContainer}>
      <Text style={styles.questionText}>{game.question}</Text>
      <View style={styles.optionsList}>
        {game.options.map((opt, i) => {
          let bg = "#14141f",
            border = "#1e1e30",
            textColor = COLORS.onSurface;
          if (submitted && i === game.answer) {
            bg = SAVE + "15";
            border = SAVE;
            textColor = SAVE;
          } else if (submitted && i === selected && !correct) {
            bg = SKIP + "15";
            border = SKIP;
            textColor = SKIP;
          } else if (selected === i) {
            bg = COLORS.primary + "18";
            border = COLORS.primary;
            textColor = COLORS.primary;
          }
          return (
            <TouchableOpacity
              key={i}
              style={[
                styles.option,
                { backgroundColor: bg, borderColor: border },
              ]}
              onPress={() => handleSelect(i)}
              activeOpacity={0.7}
            >
              <View
                style={[
                  styles.optionLetter,
                  selected === i && { backgroundColor: COLORS.primary + "30" },
                ]}
              >
                <Text style={[styles.optionLetterText, { color: textColor }]}>
                  {String.fromCharCode(65 + i)}
                </Text>
              </View>
              <Text style={[styles.optionText, { color: textColor }]}>
                {opt}
              </Text>
              {submitted && i === game.answer && (
                <Feather name="check-circle" size={18} color={SAVE} />
              )}
              {submitted && i === selected && !correct && (
                <Feather name="x-circle" size={18} color={SKIP} />
              )}
            </TouchableOpacity>
          );
        })}
      </View>
      {!submitted && (
        <TouchableOpacity
          style={[
            styles.submitBtn,
            selected === null && styles.submitBtnDisabled,
          ]}
          onPress={handleSubmit}
          disabled={selected === null}
          activeOpacity={0.85}
        >
          <Text style={styles.submitBtnText}>Submit Answer</Text>
        </TouchableOpacity>
      )}
      {submitted && (
        <View
          style={[
            styles.resultBanner,
            correct ? styles.resultCorrect : styles.resultWrong,
          ]}
        >
          <Feather
            name={correct ? "check-circle" : "x-circle"}
            size={16}
            color={correct ? SAVE : SKIP}
          />
          <Text style={styles.resultText}>{game.explanation}</Text>
        </View>
      )}
    </View>
  );
};

// ── Word Scramble ──
const WordScrambleView: React.FC<{
  game: WordScrambleGame;
  onComplete: (correct: boolean) => void;
}> = ({ game, onComplete }) => {
  const [input, setInput] = React.useState("");
  const [submitted, setSubmitted] = React.useState(false);
  const correct = input.trim().toUpperCase() === game.word.toUpperCase();

  const handleSubmit = () => {
    if (!input.trim()) return;
    setSubmitted(true);
    Haptics.notificationAsync(
      correct
        ? Haptics.NotificationFeedbackType.Success
        : Haptics.NotificationFeedbackType.Error,
    );
    setTimeout(() => onComplete(correct), 1400);
  };

  return (
    <View style={styles.gameContainer}>
      <View style={styles.scrambleBox}>
        <Text style={styles.scrambleText}>{game.scrambled}</Text>
      </View>
      <Text style={styles.hintText}>💡 {game.hint}</Text>
      <TextInput
        style={styles.scrambleInput}
        placeholder="Type the word..."
        placeholderTextColor={COLORS.onSurfaceVariant}
        value={input}
        onChangeText={setInput}
        autoCapitalize="characters"
        autoCorrect={false}
        onSubmitEditing={handleSubmit}
        editable={!submitted}
        returnKeyType="done"
      />
      {!submitted && (
        <TouchableOpacity
          style={[styles.submitBtn, !input.trim() && styles.submitBtnDisabled]}
          onPress={handleSubmit}
          disabled={!input.trim()}
          activeOpacity={0.85}
        >
          <Text style={styles.submitBtnText}>Submit</Text>
        </TouchableOpacity>
      )}
      {submitted && (
        <View
          style={[
            styles.resultBanner,
            correct ? styles.resultCorrect : styles.resultWrong,
          ]}
        >
          <Feather
            name={correct ? "check-circle" : "x-circle"}
            size={16}
            color={correct ? SAVE : SKIP}
          />
          <Text style={styles.resultText}>
            {correct ? "Correct!" : `Answer: ${game.word}`}
          </Text>
        </View>
      )}
    </View>
  );
};

// ── Fill in the Blank ──
const FillBlankView: React.FC<{
  game: FillBlankGame;
  onComplete: (correct: boolean) => void;
}> = ({ game, onComplete }) => {
  const [input, setInput] = React.useState("");
  const [submitted, setSubmitted] = React.useState(false);
  const correct = input.trim().toLowerCase() === game.answer.toLowerCase();

  const handleSubmit = () => {
    if (!input.trim()) return;
    setSubmitted(true);
    Haptics.notificationAsync(
      correct
        ? Haptics.NotificationFeedbackType.Success
        : Haptics.NotificationFeedbackType.Error,
    );
    setTimeout(() => onComplete(correct), 1400);
  };

  const parts = game.sentence.split("___");

  return (
    <View style={styles.gameContainer}>
      <View style={styles.fillBlankSentence}>
        <Text style={styles.sentenceText}>{parts[0]}</Text>
        <View style={styles.blankSlot}>
          {submitted ? (
            <Text
              style={[
                styles.blankText,
                correct ? styles.blankCorrect : styles.blankWrong,
              ]}
            >
              {input || "?"}
            </Text>
          ) : (
            <TextInput
              style={styles.blankInput}
              value={input}
              onChangeText={setInput}
              autoCapitalize="none"
              autoCorrect={false}
              onSubmitEditing={handleSubmit}
              editable={!submitted}
              returnKeyType="done"
              placeholder="?"
              placeholderTextColor={COLORS.onSurfaceVariant}
            />
          )}
        </View>
        <Text style={styles.sentenceText}>{parts[1] || ""}</Text>
      </View>
      <Text style={styles.hintText}>💡 {game.hint}</Text>
      {!submitted && (
        <TouchableOpacity
          style={[styles.submitBtn, !input.trim() && styles.submitBtnDisabled]}
          onPress={handleSubmit}
          disabled={!input.trim()}
          activeOpacity={0.85}
        >
          <Text style={styles.submitBtnText}>Submit</Text>
        </TouchableOpacity>
      )}
      {submitted && (
        <View
          style={[
            styles.resultBanner,
            correct ? styles.resultCorrect : styles.resultWrong,
          ]}
        >
          <Feather
            name={correct ? "check-circle" : "x-circle"}
            size={16}
            color={correct ? SAVE : SKIP}
          />
          <Text style={styles.resultText}>
            {correct ? "Correct!" : `Answer: ${game.answer}`}
          </Text>
        </View>
      )}
    </View>
  );
};

// ── Game Router ──
export const GameCard: React.FC<Props> = ({
  gameType,
  gameData,
  onComplete,
  onSkip,
}) => {
  const renderGame = () => {
    switch (gameType) {
      case "quiz":
        return <QuizView game={gameData as QuizGame} onComplete={onComplete} />;
      case "word_scramble":
        return (
          <WordScrambleView
            game={gameData as WordScrambleGame}
            onComplete={onComplete}
          />
        );
      case "fill_blank":
        return (
          <FillBlankView
            game={gameData as FillBlankGame}
            onComplete={onComplete}
          />
        );
      default:
        return <Text style={styles.errorText}>Unknown game type</Text>;
    }
  };

  return (
    <ScrollView
      style={styles.cardScroll}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.cardScrollInner}
      keyboardShouldPersistTaps="handled"
    >
      {renderGame()}
      <TouchableOpacity
        style={styles.skipGameBtn}
        onPress={onSkip}
        activeOpacity={0.7}
      >
        <Text style={styles.skipGameText}>Skip this game</Text>
      </TouchableOpacity>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  cardScroll: { paddingHorizontal: 20 },
  cardScrollInner: { paddingBottom: 32 },
  gameContainer: { gap: 16 },
  questionText: {
    fontSize: 20,
    fontWeight: "800",
    color: COLORS.onSurface,
    lineHeight: 28,
    paddingTop: 4,
  },
  optionsList: { gap: 10 },
  option: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1.5,
  },
  optionLetter: {
    width: 30,
    height: 30,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#14141f",
  },
  optionLetterText: { fontSize: 14, fontWeight: "800" },
  optionText: { fontSize: 15, fontWeight: "600", flex: 1 },
  submitBtn: {
    backgroundColor: COLORS.primary,
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: "center",
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 6,
  },
  submitBtnDisabled: { opacity: 0.35 },
  submitBtnText: {
    color: COLORS.black,
    fontWeight: "800",
    fontSize: 16,
    letterSpacing: 0.5,
  },
  resultBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 14,
    borderRadius: 14,
  },
  resultCorrect: { backgroundColor: SAVE + "12" },
  resultWrong: { backgroundColor: SKIP + "12" },
  resultText: {
    fontSize: 13,
    color: COLORS.onSurfaceVariant,
    flex: 1,
    lineHeight: 19,
  },
  scrambleBox: {
    backgroundColor: "#14141f",
    padding: 24,
    borderRadius: 20,
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: COLORS.secondary + "30",
    borderStyle: "dashed",
  },
  scrambleText: {
    fontSize: 36,
    fontWeight: "900",
    color: COLORS.secondary,
    letterSpacing: 10,
  },
  hintText: {
    fontSize: 14,
    color: COLORS.onSurfaceVariant,
    fontStyle: "italic",
  },
  scrambleInput: {
    backgroundColor: "#14141f",
    borderWidth: 1.5,
    borderColor: COLORS.primary + "40",
    borderRadius: 16,
    paddingHorizontal: 18,
    paddingVertical: 16,
    fontSize: 22,
    fontWeight: "800",
    color: COLORS.onSurface,
    textAlign: "center",
    letterSpacing: 4,
  },
  fillBlankSentence: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 8,
  },
  sentenceText: { fontSize: 20, color: COLORS.onSurface, lineHeight: 30 },
  blankSlot: { minWidth: 100, alignItems: "center", justifyContent: "center" },
  blankInput: {
    backgroundColor: "#14141f",
    borderWidth: 2,
    borderColor: COLORS.secondary,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 20,
    fontWeight: "800",
    color: COLORS.onSurface,
    textAlign: "center",
    minWidth: 90,
  },
  blankText: {
    fontSize: 20,
    fontWeight: "800",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    minWidth: 90,
    textAlign: "center",
  },
  blankCorrect: { backgroundColor: SAVE + "18", color: SAVE },
  blankWrong: { backgroundColor: SKIP + "18", color: SKIP },
  skipGameBtn: { alignItems: "center", paddingVertical: 12, marginTop: 12 },
  skipGameText: {
    fontSize: 13,
    color: COLORS.onSurfaceVariant,
    fontWeight: "600",
  },
  errorText: { color: SKIP, textAlign: "center" },
});
