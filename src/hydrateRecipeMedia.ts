import type { Recipe } from './types'

const generatedRecipeImages = import.meta.glob<string>('./assets/recipes/generated/*.jpg', {
  eager: true,
  import: 'default',
})

const generatedStepImages = import.meta.glob<string>('./assets/recipes/steps/*.jpg', {
  eager: true,
  import: 'default',
})

export function hydrateRecipeMedia(recipe: Recipe): Recipe {
  const image = recipe.image
    ?? generatedRecipeImages[`./assets/recipes/generated/${recipe.id}.jpg`]

  return {
    ...recipe,
    image,
    imageAlt: image ? (recipe.imageAlt ?? `${recipe.title}成品示意图`) : recipe.imageAlt,
    imageKind: image ? (recipe.imageKind ?? 'ai-generated') : recipe.imageKind,
    steps: recipe.steps.map((step, index) => {
      if (step.image) return step
      const stepImage = generatedStepImages[`./assets/recipes/steps/${recipe.id}-${index + 1}.jpg`]
      return {
        ...step,
        image: stepImage,
        imageAlt: stepImage ? `${recipe.title}第 ${index + 1} 步“${step.title}”的 AI 示意图` : undefined,
        imageKind: stepImage ? 'ai-generated' : undefined,
      }
    }),
  }
}

export function hydrateRecipeCollection(recipes: Recipe[]): Recipe[] {
  return recipes.map(hydrateRecipeMedia)
}
