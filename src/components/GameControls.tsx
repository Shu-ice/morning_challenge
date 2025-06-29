import React from 'react';

interface GameControlsProps {
  currentProblem: number;
  totalProblems: number;
  isComplete: boolean;
  onPrevious: () => void;
  onNext: () => void;
  onComplete: () => void;
  onBack: () => void;
  className?: string;
}

export const GameControls: React.FC<GameControlsProps> = ({
  currentProblem,
  totalProblems,
  isComplete,
  onPrevious,
  onNext,
  onComplete,
  onBack,
  className = ""
}) => {
  const isFirstProblem = currentProblem === 0;
  const isLastProblem = currentProblem === totalProblems - 1;

  return (
    <div className={`flex justify-between items-center gap-4 ${className}`}>
      {/* Back to Menu Button */}
      <button onClick={onBack} className="button button-secondary">
        ← <ruby>メニュー<rt>めにゅー</rt></ruby>に<ruby>戻<rt>もど</rt></ruby>る
      </button>

      {/* Navigation Controls */}
      <div className="flex gap-3">
        {/* Previous Button */}
        <button
          onClick={onPrevious}
          disabled={isFirstProblem}
          className="button button-secondary disabled:opacity-50 disabled:cursor-not-allowed"
        >
          ← <ruby>前<rt>まえ</rt></ruby>の<ruby>問題<rt>もんだい</rt></ruby>
        </button>

        {/* Next/Complete Button */}
        {isLastProblem ? (
          <button
            onClick={onComplete}
            disabled={!isComplete}
            className="button button-primary disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isComplete ? (
              <>完了して<ruby>提出<rt>ていしゅつ</rt></ruby></>
            ) : (
              <>全<ruby>問題<rt>もんだい</rt></ruby>に<ruby>回答<rt>かいとう</rt></ruby>してください</>
            )}
          </button>
        ) : (
          <button onClick={onNext} className="button button-primary">
            <ruby>次<rt>つぎ</rt></ruby>の<ruby>問題<rt>もんだい</rt></ruby> →
          </button>
        )}
      </div>
    </div>
  );
};