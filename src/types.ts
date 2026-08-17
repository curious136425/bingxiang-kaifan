export type Taste = '咸鲜' | '微辣' | '香辣' | '酸爽' | '酸甜' | '清淡' | '浓郁'

export type IngredientRole = 'core' | 'support' | 'seasoning'

export type RecipeIngredient = {
  name: string
  amount: number | string
  unit: string
  role: IngredientRole
  substitutes?: string[]
}

export type RecipeStep = {
  title: string
  text: string
  heat?: '不开火' | '小火' | '中火' | '大火'
  timerSeconds?: number
  tip?: string
  image?: string
  imageAlt?: string
  imageKind?: 'source' | 'ai-generated'
}

export type Recipe = {
  id: string
  title: string
  subtitle: string
  emoji: string
  colors: [string, string]
  image?: string
  imageAlt?: string
  imageKind?: 'source' | 'ai-generated'
  minutes: number
  difficulty: 1 | 2 | 3
  rating?: number
  calories?: number
  servings: number
  vegetarian: boolean
  tastes: Taste[]
  cookware: string
  ingredients: RecipeIngredient[]
  steps: RecipeStep[]
  tips: string[]
  source?: {
    title: string
    pdfPage: number
    printedPage?: number
    note?: string
  }
}

export type Preferences = {
  tastes: Taste[]
  maxMinutes: number | null
  skillLevel: 1 | 2 | 3
  seasoningsReady: boolean
  vegetarianOnly: boolean
}

export type Recommendation = {
  recipe: Recipe
  score: number
  matched: string[]
  missing: string[]
  missingCore: string[]
  reasons: string[]
  tasteMatches: Taste[]
}
