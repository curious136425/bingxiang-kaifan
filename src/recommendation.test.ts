import { describe, expect, it } from 'vitest'
import recipes from './data'
import { canonicalizeIngredient, rankRecipes } from './recommendation'
import type { Preferences } from './types'

const defaultPreferences: Preferences = {
  tastes: ['咸鲜', '微辣'],
  maxMinutes: 30,
  skillLevel: 1,
  seasoningsReady: true,
  vegetarianOnly: false,
}

describe('ingredient normalization', () => {
  it('normalizes common Chinese aliases', () => {
    expect(canonicalizeIngredient('西红柿')).toBe('番茄')
    expect(canonicalizeIngredient('隔夜饭')).toBe('米饭')
    expect(canonicalizeIngredient(' 香葱 ')).toBe('小葱')
  })
})

describe('recipe ranking', () => {
  it('ships exactly one hundred unique home recipes', () => {
    expect(recipes).toHaveLength(100)
    expect(new Set(recipes.map((recipe) => recipe.id)).size).toBe(100)
    expect(new Set(recipes.map((recipe) => recipe.title)).size).toBe(100)
  })

  it('ships a finished photo and an illustrated tutorial for every recipe', () => {
    expect(recipes.every((recipe) => recipe.image && recipe.imageAlt && recipe.imageKind)).toBe(true)
    expect(recipes.reduce((total, recipe) => total + recipe.steps.length, 0)).toBe(401)
    expect(recipes.every((recipe) => (
      recipe.steps.length > 0
      && recipe.steps.every((step) => step.image && step.imageAlt && step.imageKind)
    ))).toBe(true)
  })

  it('includes cookbook imports with traceable page sources', () => {
    const imported = recipes.filter((recipe) => recipe.source)
    expect(imported).toHaveLength(8)
    expect(imported.every((recipe) => recipe.image && recipe.imageAlt)).toBe(true)
    expect(imported.every((recipe) => recipe.steps.every((step) => step.image && step.imageKind === 'ai-generated'))).toBe(true)
    expect(imported.find((recipe) => recipe.title === '客家酿苦瓜')?.source?.pdfPage).toBe(59)
    expect(imported.find((recipe) => recipe.title === '剁椒蒸丝瓜')?.steps.length).toBeGreaterThan(0)
  })

  it('puts a fully matched recipe ahead of recipes missing core ingredients', () => {
    const result = rankRecipes(
      recipes,
      ['青椒', '猪里脊', '姜'],
      defaultPreferences,
    )

    expect(result[0].recipe.id).toBe('qingjiao-rousi')
    expect(result[0].missingCore).toHaveLength(0)
    expect(result[0].score).toBeGreaterThan(90)
  })

  it('respects the vegetarian filter', () => {
    const result = rankRecipes(
      recipes,
      ['青椒', '鸡蛋', '土豆'],
      { ...defaultPreferences, vegetarianOnly: true },
    )

    expect(result.length).toBeGreaterThan(0)
    expect(result.every(({ recipe }) => recipe.vegetarian)).toBe(true)
  })

  it('uses taste and time as meaningful secondary signals', () => {
    const result = rankRecipes(
      recipes,
      ['豆腐', '香菇', '小白菜'],
      { ...defaultPreferences, tastes: ['清淡'], maxMinutes: 20 },
    )

    expect(result[0].recipe.id).toBe('mushroom-tofu-soup')
    expect(result[0].tasteMatches).toContain('清淡')
  })
})
