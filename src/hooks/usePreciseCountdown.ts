import { useState, useRef, useCallback, useLayoutEffect } from 'react';

type UsePreciseCountdownReturn = {
  count: number | null;
  startCountdown: (initialCount: number) => void;
};

/**
 * シンプルでより確実なカウントダウンフック
 * @param intervalMs カウントダウンの間隔 (ミリ秒)
 * @param onComplete カウントダウン完了時に呼び出されるコールバック
 * @returns { count: number | null, startCountdown: (initialCount: number) => void }
 */
export const usePreciseCountdown = (
  intervalMs: number,
  onComplete?: () => void
): UsePreciseCountdownReturn => {
  const [count, setCount] = useState<number | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef(true); // マウント状態を追跡
  const onCompleteRef = useRef(onComplete);

  // コールバックの参照を更新
  useLayoutEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  // マウント・アンマウント管理
  useLayoutEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      // クリーンアップ時にタイマーをクリア
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, []);

  // カウントダウンを開始する関数
  const startCountdown = useCallback((initialCount: number) => {
    // タイマーを初期化
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    // 初期カウントを設定
    setCount(initialCount);
    
    // 再帰的なカウントダウン処理
    const tick = (currentCount: number) => {
      // コンポーネントがアンマウントされていたら何もしない
      if (!isMountedRef.current) return;
      
      if (currentCount <= 0) {
        // カウントが0以下になったら完了
        if (onCompleteRef.current) {
          // 即時にコールバックを呼び出し
          onCompleteRef.current();
        }
        return;
      }
      
      // 次のカウントダウンをセット (少し早めにスケジュールして遅延を防ぐ)
      timerRef.current = setTimeout(() => {
        if (!isMountedRef.current) return;
        // カウントを1減らす
        const nextCount = currentCount - 1;
        // 確実にレンダリングするためにステート更新
        setCount(prevCount => {
          console.log(`カウントダウン: ${prevCount} → ${nextCount}`); // デバッグ用ログ
          return nextCount;
        });
        
        // 次のカウントダウンを実行
        tick(nextCount);
      }, intervalMs);
    };
    
    // カウントダウン開始 (初回は即時実行して表示を確実にする)
    setTimeout(() => {
      tick(initialCount);
    }, 10);
  }, [intervalMs]);

  return { count, startCountdown };
};