import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { problemsAPI } from '../api/index'
import type { DifficultyRank } from '../types/difficulty'
import type { ProblemResult } from '../types/index'

// 型定義
interface Problem {
  id: string
  question: string
  options?: string[] | number[] // any[]からより具体的な型へ
}

interface SubmitAnswersRequest {
  answers: number[]
  difficulty: DifficultyRank
  totalTime: number
  startTime: number
}

interface ApiProblemsResponse {
  success: boolean
  problems: Problem[]
  difficulty: DifficultyRank
  date: string
}

// ===== クエリキー定数 =====
export const QUERY_KEYS = {
  problems: 'problems',
  rankings: 'rankings',
  history: 'history',
  user: 'user',
} as const

// ===== 問題取得フック =====
export const useProblems = (difficulty: DifficultyRank, date: string) => {
  return useQuery({
    queryKey: [QUERY_KEYS.problems, difficulty, date],
    queryFn: () => problemsAPI.getProblems(difficulty, date),
    enabled: !!difficulty && !!date, // 必要なパラメータがある場合のみ実行
    staleTime: 10 * 60 * 1000, // 10分間フレッシュ
    select: (data: { success: boolean; message?: string; problems?: Problem[]; difficulty?: DifficultyRank; date?: string }) => {
      // データ変換ロジック
      return {
        ...data,
        problems: data.problems?.map((p, index: number) => ({
          ...p,
          id: p.id || String(index + 1),
        })) || [],
      }
    },
  })
}

// ===== ランキング取得フック（重複削除の主役） =====
export const useRankings = (date: string, difficulty?: DifficultyRank) => {
  return useQuery({
    queryKey: [QUERY_KEYS.rankings, date, difficulty],
    queryFn: async () => {
      // 複数の難易度のランキングを一度に取得
      const difficulties: DifficultyRank[] = ['beginner', 'intermediate', 'advanced', 'expert']
      
      if (difficulty) {
        // 特定の難易度のみ
        const response = await fetch(`/api/rankings?limit=50&difficulty=${difficulty}&date=${date}`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
            'Content-Type': 'application/json',
          },
        })
        const data = await response.json()
        return { [difficulty]: data.data || [] }
      } else {
        // 全難易度を並列取得
        const promises = difficulties.map(async (diff) => {
          const response = await fetch(`/api/rankings?limit=50&difficulty=${diff}&date=${date}`, {
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('token')}`,
              'Content-Type': 'application/json',
            },
          })
          const data = await response.json()
          return { [diff]: data.data || [] }
        })
        
        const results = await Promise.all(promises)
        return results.reduce((acc, curr) => ({ ...acc, ...curr }), {})
      }
    },
    staleTime: 2 * 60 * 1000, // ランキングは2分間フレッシュ
    enabled: !!date,
  })
}

// ===== 履歴取得フック =====
export const useHistory = (userId?: string) => {
  return useQuery({
    queryKey: [QUERY_KEYS.history, userId],
    queryFn: async () => {
      const url = userId ? `/api/problems/history?userId=${userId}` : '/api/problems/history'
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json',
        },
      })
      
      if (!response.ok) {
        throw new Error('履歴の取得に失敗しました')
      }
      
      return response.json()
    },
    staleTime: 30 * 1000, // 30秒間フレッシュ
  })
}

// ===== 回答送信ミューテーション =====
export const useSubmitAnswers = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async (data: {
      difficulty: DifficultyRank
      date: string
      problemIds: string[]
      answers: string[]
      timeSpentMs: number
      userId: string
    }) => {
      return problemsAPI.submitAnswers(data)
    },
    onSuccess: (data, variables) => {
      // 成功時にキャッシュを更新
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.history] })
      queryClient.invalidateQueries({ 
        queryKey: [QUERY_KEYS.rankings, variables.date] 
      })
      
      // 特定のクエリのデータを更新
      queryClient.setQueryData(
        [QUERY_KEYS.rankings, variables.date, variables.difficulty],
        (oldData: unknown) => {
          if (!oldData) return oldData
          // 新しいランキングデータがあれば更新
          return (data as { results?: { rankings?: unknown } }).results?.rankings || oldData
        }
      )
    },
    onError: (error) => {
      console.error('回答送信エラー:', error)
    },
  })
}

// ===== プリフェッチユーティリティ =====
export const usePrefetchData = () => {
  const queryClient = useQueryClient()
  
  const prefetchProblems = (difficulty: DifficultyRank, date: string) => {
    queryClient.prefetchQuery({
      queryKey: [QUERY_KEYS.problems, difficulty, date],
      queryFn: () => problemsAPI.getProblems(difficulty, date),
      staleTime: 10 * 60 * 1000,
    })
  }
  
  const prefetchRankings = (date: string) => {
    queryClient.prefetchQuery({
      queryKey: [QUERY_KEYS.rankings, date],
      queryFn: async () => {
        const difficulties: DifficultyRank[] = ['beginner', 'intermediate', 'advanced', 'expert']
        const promises = difficulties.map(async (diff) => {
          const response = await fetch(`/api/rankings?limit=50&difficulty=${diff}&date=${date}`, {
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('token')}`,
              'Content-Type': 'application/json',
            },
          })
          const data = await response.json()
          return { [diff]: data.data || [] }
        })
        
        const results = await Promise.all(promises)
        return results.reduce((acc, curr) => ({ ...acc, ...curr }), {})
      },
      staleTime: 2 * 60 * 1000,
    })
  }
  
  return { prefetchProblems, prefetchRankings }
} 