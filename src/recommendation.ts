import { basicSeasonings } from './data'
import type { Preferences, Recipe, Recommendation } from './types'

const aliases: Record<string, string> = {
  西红柿: '番茄',
  马铃薯: '土豆',
  瘦肉: '猪里脊',
  猪肉: '猪里脊',
  里脊肉: '猪里脊',
  葱: '小葱',
  香葱: '小葱',
  青葱: '小葱',
  蒜: '大蒜',
  蒜头: '大蒜',
  嫩豆腐: '豆腐',
  北豆腐: '豆腐',
  剩米饭: '米饭',
  隔夜饭: '米饭',
  白饭: '米饭',
  鲜虾: '虾仁',
  蘑菇: '香菇',
}

export function canonicalizeIngredient(raw: string): string {
  const cleaned = raw.trim().replace(/[，,。.!！?？]/g, '')
  return aliases[cleaned] ?? cleaned
}

export function normalizePantry(items: string[]): string[] {
  return Array.from(new Set(items.map(canonicalizeIngredient).filter(Boolean)))
}

function scoreRecipe(
  recipe: Recipe,
  pantry: Set<string>,
  preferences: Preferences,
  expiring: Set<string>,
): Recommendation {
  const available = new Set(pantry)
  if (preferences.seasoningsReady) {
    basicSeasonings.forEach((item) => available.add(item))
  }

  const relevantIngredients = recipe.ingredients.filter((item) => item.role !== 'seasoning')
  const ingredientWeight = (role: 'core' | 'support' | 'seasoning') => role === 'core' ? 3 : role === 'support' ? 1 : 0
  const totalWeight = relevantIngredients.reduce((sum, item) => sum + ingredientWeight(item.role), 0)
  const matchedWeight = relevantIngredients.reduce(
    (sum, item) => sum + (available.has(item.name) ? ingredientWeight(item.role) : 0),
    0,
  )
  const ingredientScore = totalWeight === 0 ? 50 : 50 * matchedWeight / totalWeight

  const tasteMatches = recipe.tastes.filter((taste) => preferences.tastes.includes(taste))
  const tasteScore = preferences.tastes.length === 0
    ? 20
    : 20 * tasteMatches.length / preferences.tastes.length

  const timeScore = preferences.maxMinutes === null || recipe.minutes <= preferences.maxMinutes
    ? 12
    : Math.max(0, 12 - (recipe.minutes - preferences.maxMinutes) * 0.6)

  const difficultyGap = recipe.difficulty - preferences.skillLevel
  const difficultyScore = difficultyGap <= 0 ? 8 : Math.max(0, 8 - difficultyGap * 4)

  const expiringRelevant = [...expiring].filter((item) => relevantIngredients.some((ingredient) => ingredient.name === item))
  const freshnessScore = expiring.size === 0
    ? 5
    : 5 * expiringRelevant.length / expiring.size

  const matched = recipe.ingredients
    .filter((item) => available.has(item.name))
    .map((item) => item.name)
  const missing = recipe.ingredients
    .filter((item) => !available.has(item.name))
    .map((item) => item.name)
  const missingCore = recipe.ingredients
    .filter((item) => item.role === 'core' && !available.has(item.name))
    .map((item) => item.name)

  const coreIngredients = recipe.ingredients.filter((item) => item.role === 'core')
  const matchedCoreCount = coreIngredients.length - missingCore.length
  const reasons: string[] = []
  if (missingCore.length === 0) {
    reasons.push('核心食材都齐了')
  } else if (matchedCoreCount > 0) {
    reasons.push(`${matchedCoreCount}/${coreIngredients.length} 样核心食材已备`)
  }
  if (tasteMatches.length > 0) {
    reasons.push(`正合你选的${tasteMatches.slice(0, 2).join('、')}口味`)
  }
  if (expiringRelevant.length > 0) {
    reasons.push(`可以优先用掉${expiringRelevant.join('、')}`)
  }
  if (recipe.minutes <= 15 && reasons.length < 2) {
    reasons.push(`${recipe.minutes} 分钟快手完成`)
  }
  if (reasons.length === 0) {
    reasons.push('补少量食材就能换个口味')
  }

  const rawScore = ingredientScore + tasteScore + timeScore + difficultyScore + freshnessScore + (recipe.rating ?? 4.5)

  return {
    recipe,
    score: Math.max(0, Math.min(99, Math.round(rawScore))),
    matched,
    missing,
    missingCore,
    reasons: reasons.slice(0, 2),
    tasteMatches,
  }
}

export function rankRecipes(
  recipes: Recipe[],
  pantryItems: string[],
  preferences: Preferences,
  expiringItems: string[] = [],
): Recommendation[] {
  const pantry = new Set(normalizePantry(pantryItems))
  const expiring = new Set(normalizePantry(expiringItems))

  return recipes
    .filter((recipe) => !preferences.vegetarianOnly || recipe.vegetarian)
    .map((recipe) => scoreRecipe(recipe, pantry, preferences, expiring))
    .sort((a, b) => (
      b.score - a.score
      || a.missingCore.length - b.missingCore.length
      || a.missing.length - b.missing.length
      || a.recipe.minutes - b.recipe.minutes
      || (b.recipe.rating ?? 0) - (a.recipe.rating ?? 0)
    ))
}
