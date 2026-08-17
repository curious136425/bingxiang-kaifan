import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  BookOpen,
  Check,
  ChefHat,
  ChevronRight,
  CircleCheck,
  Clock3,
  CookingPot,
  Flame,
  Heart,
  Home,
  Leaf,
  ListChecks,
  Minus,
  PackageCheck,
  Plus,
  Refrigerator,
  RotateCcw,
  Search,
  ShoppingBasket,
  SlidersHorizontal,
  Sparkles,
  Star,
  TimerReset,
  Trash2,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react'
import recipes, { allIngredients, basicSeasonings, ingredientGroups, tasteOptions } from './data'
import { canonicalizeIngredient, rankRecipes } from './recommendation'
import { readStorage, writeStorage } from './storage'
import type { Preferences, Recipe, Recommendation, Taste } from './types'

type View = 'discover' | 'pantry' | 'saved'
type SortMode = 'match' | 'fast' | 'missing'

const defaultPantry = ['番茄', '鸡蛋', '土豆', '青椒', '猪里脊', '米饭']
const defaultPreferences: Preferences = {
  tastes: ['咸鲜', '微辣'],
  maxMinutes: 30,
  skillLevel: 1,
  seasoningsReady: true,
  vegetarianOnly: false,
}

function FoodVisual({ recipe, compact = false }: { recipe: Recipe; compact?: boolean }) {
  return (
    <div
      className={`food-visual${compact ? ' food-visual--compact' : ''}${recipe.image ? ' food-visual--photo' : ''}`}
      style={{ '--food-a': recipe.colors[0], '--food-b': recipe.colors[1] } as React.CSSProperties}
      aria-label={recipe.image ? undefined : `${recipe.title}插画`}
    >
      {recipe.image ? (
        <>
          <img
            className="food-visual__photo"
            src={recipe.image}
            alt={recipe.imageAlt ?? `${recipe.title}成品照片`}
            loading={compact ? 'lazy' : 'eager'}
          />
          {recipe.imageKind === 'ai-generated' && <span className="food-visual__ai-label"><Sparkles size={11} /> AI 成品示意</span>}
        </>
      ) : (
        <>
          <span className="food-visual__leaf food-visual__leaf--one" />
          <span className="food-visual__leaf food-visual__leaf--two" />
          <div className="food-visual__plate">
            <span>{recipe.emoji}</span>
          </div>
          <span className="food-visual__steam">〰</span>
        </>
      )}
    </div>
  )
}

function RecipeCard({
  item,
  favorite,
  onFavorite,
  onOpen,
}: {
  item: Recommendation
  favorite: boolean
  onFavorite: () => void
  onOpen: () => void
}) {
  const { recipe } = item
  return (
    <article className="recipe-card">
      <button className="recipe-card__visual-button" onClick={onOpen} aria-label={`查看${recipe.title}教程`}>
        <FoodVisual recipe={recipe} compact />
        <span className="match-badge"><Sparkles size={13} /> {item.score}% 匹配</span>
      </button>
      <div className="recipe-card__body">
        <div className="recipe-card__heading">
          <button className="recipe-card__title-button" onClick={onOpen}>
            <h3>{recipe.title}</h3>
            <p>{recipe.subtitle}</p>
          </button>
          <button
            className={`icon-button${favorite ? ' icon-button--active' : ''}`}
            onClick={onFavorite}
            aria-label={favorite ? `取消收藏${recipe.title}` : `收藏${recipe.title}`}
            aria-pressed={favorite}
          >
            <Heart size={19} fill={favorite ? 'currentColor' : 'none'} />
          </button>
        </div>
        <div className="meta-row">
          <span><Clock3 size={14} /> {recipe.minutes} 分钟</span>
          <span><ChefHat size={14} /> {['', '新手', '家常', '进阶'][recipe.difficulty]}</span>
          {recipe.source
            ? <span><BookOpen size={14} /> 书籍导入</span>
            : <span><Star size={14} fill="currentColor" /> {recipe.rating}</span>}
        </div>
        <div className="tag-row">
          {recipe.tastes.slice(0, 2).map((taste) => <span key={taste}>{taste}</span>)}
          {item.missingCore.length === 0
            ? <span className="tag tag--ready"><CircleCheck size={13} /> 核心食材齐</span>
            : <span className="tag tag--missing">还差 {item.missingCore.length} 样</span>}
        </div>
        <div className="reason-line">
          <span className="reason-line__mark"><Sparkles size={13} /></span>
          <span>{item.reasons.join('，')}</span>
        </div>
        <button className="text-button" onClick={onOpen}>
          查看分步教程 <ChevronRight size={16} />
        </button>
      </div>
    </article>
  )
}

function RecipeDetail({
  item,
  pantry,
  shopping,
  onToggleShopping,
  onClose,
  onCook,
}: {
  item: Recommendation
  pantry: string[]
  shopping: string[]
  onToggleShopping: (name: string) => void
  onClose: () => void
  onCook: (recipe: Recipe) => void
}) {
  const [servings, setServings] = useState(item.recipe.servings)
  const recipe = item.recipe
  const available = new Set(item.matched)
  const scale = servings / recipe.servings

  useEffect(() => {
    const handler = (event: KeyboardEvent) => event.key === 'Escape' && onClose()
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const formatAmount = (amount: number | string) => {
    if (typeof amount === 'string') return amount
    const value = Math.round(amount * scale * 10) / 10
    return Number.isInteger(value) ? String(value) : value.toFixed(1)
  }

  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="detail-panel" role="dialog" aria-modal="true" aria-label={`${recipe.title}菜谱详情`}>
        <div className="detail-panel__topbar">
          <button className="round-button" onClick={onClose} aria-label="关闭详情"><X size={20} /></button>
          <span className="detail-panel__eyebrow">菜谱教程</span>
          <span className="detail-panel__score">{item.score}% 匹配</span>
        </div>

        <FoodVisual recipe={recipe} />

        <div className="detail-content">
          <div className="detail-title-row">
            <div>
              <p className="eyebrow">今晚推荐</p>
              <h2>{recipe.title}</h2>
              <p>{recipe.subtitle}</p>
            </div>
            <div className="rating-pill">
              {recipe.source ? <><BookOpen size={15} /> 书籍配方</> : <><Star size={15} fill="currentColor" /> {recipe.rating}</>}
            </div>
          </div>

          <div className="detail-stats">
            <div><Clock3 size={18} /><strong>{recipe.minutes}</strong><span>分钟</span></div>
            <div><ChefHat size={18} /><strong>{['', '新手', '家常', '进阶'][recipe.difficulty]}</strong><span>难度</span></div>
            <div><Flame size={18} /><strong>{recipe.calories ?? '—'}</strong><span>{recipe.calories ? '千卡/份' : '热量未录入'}</span></div>
          </div>

          {recipe.source && (
            <div className="source-note">
              <BookOpen size={18} />
              <div>
                <strong>来源：{recipe.source.title}</strong>
                <p>PDF 第 {recipe.source.pdfPage} 页{recipe.source.printedPage ? `（书内第 ${recipe.source.printedPage} 页）` : ''}。{recipe.source.note}{recipe.steps.some((step) => step.imageKind === 'ai-generated') ? ' 步骤图由 AI 生成，仅作动作示意，以文字配方为准。' : ''}</p>
              </div>
            </div>
          )}

          <div className="recommend-note">
            <span><Sparkles size={18} /></span>
            <div><strong>为什么推荐给你</strong><p>{item.reasons.join('；')}。{item.missingCore.length === 0 ? '现在就能开火。' : `补上${item.missingCore.join('、')}就能做。`}</p></div>
          </div>

          <section className="detail-section">
            <div className="section-heading">
              <div><p className="eyebrow">准备清单</p><h3>食材</h3></div>
              <div className="serving-stepper" aria-label="调整份量">
                <button onClick={() => setServings((value) => Math.max(1, value - 1))} aria-label="减少一人份"><Minus size={15} /></button>
                <span>{servings} 人份</span>
                <button onClick={() => setServings((value) => Math.min(6, value + 1))} aria-label="增加一人份"><Plus size={15} /></button>
              </div>
            </div>
            <div className="ingredient-list">
              {recipe.ingredients.map((ingredient) => {
                const hasIt = available.has(ingredient.name) || pantry.includes(ingredient.name)
                const inShopping = shopping.includes(ingredient.name)
                return (
                  <div className="ingredient-row" key={ingredient.name}>
                    <span className={`ingredient-status${hasIt ? ' ingredient-status--ready' : ''}`}>
                      {hasIt ? <Check size={14} /> : <Plus size={14} />}
                    </span>
                    <div className="ingredient-row__name">
                      <strong>{ingredient.name}</strong>
                      {ingredient.substitutes && !hasIt && <small>可换 {ingredient.substitutes.join(' / ')}</small>}
                    </div>
                    <span className="ingredient-row__amount">{formatAmount(ingredient.amount)} {ingredient.unit}</span>
                    {!hasIt && (
                      <button
                        className={`shopping-toggle${inShopping ? ' shopping-toggle--added' : ''}`}
                        onClick={() => onToggleShopping(ingredient.name)}
                      >
                        {inShopping ? '已加入' : '补买'}
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          </section>

          <section className="detail-section">
            <div className="section-heading">
              <div><p className="eyebrow">跟着做</p><h3>{recipe.steps.length} 个步骤</h3></div>
              <span className="cookware-pill"><CookingPot size={14} /> {recipe.cookware}</span>
            </div>
            <ol className="step-preview-list">
              {recipe.steps.map((step, index) => (
                <li key={step.title} className={step.image ? 'step-preview-list__with-image' : undefined}>
                  {step.image && (
                    <figure className="step-preview-media">
                      <img src={step.image} alt={step.imageAlt ?? `${step.title}示意图`} loading="lazy" />
                      {step.imageKind === 'ai-generated' && <figcaption><Sparkles size={12} /> AI 步骤示意</figcaption>}
                    </figure>
                  )}
                  <span>{String(index + 1).padStart(2, '0')}</span>
                  <div><strong>{step.title}</strong><p>{step.text}</p></div>
                  {step.heat && <em>{step.heat}</em>}
                </li>
              ))}
            </ol>
          </section>

          <section className="tips-card">
            <div><BadgeCheck size={20} /><strong>稳稳成功的小提示</strong></div>
            {recipe.tips.map((tip) => <p key={tip}>· {tip}</p>)}
          </section>
        </div>

        <div className="detail-actions">
          <button className="secondary-action" onClick={onClose}>稍后再看</button>
          <button className="primary-action" onClick={() => onCook(recipe)}><ChefHat size={18} /> 开始烹饪</button>
        </div>
      </section>
    </div>
  )
}

function CookingMode({ recipe, onClose, onComplete }: { recipe: Recipe; onClose: () => void; onComplete: () => void }) {
  const storedStep = readStorage<number>(`kaifan.progress.${recipe.id}`, 0)
  const [stepIndex, setStepIndex] = useState(Math.min(storedStep, recipe.steps.length - 1))
  const [timerLeft, setTimerLeft] = useState(recipe.steps[stepIndex].timerSeconds ?? 0)
  const [timerRunning, setTimerRunning] = useState(false)
  const [voiceOn, setVoiceOn] = useState(false)
  const [finished, setFinished] = useState(false)
  const step = recipe.steps[stepIndex]

  useEffect(() => {
    setTimerLeft(step.timerSeconds ?? 0)
    setTimerRunning(false)
    writeStorage(`kaifan.progress.${recipe.id}`, stepIndex)
  }, [recipe.id, step.timerSeconds, stepIndex])

  useEffect(() => {
    if (!timerRunning || timerLeft <= 0) return
    const id = window.setInterval(() => setTimerLeft((value) => Math.max(0, value - 1)), 1000)
    return () => window.clearInterval(id)
  }, [timerLeft, timerRunning])

  useEffect(() => {
    if (timerLeft === 0) setTimerRunning(false)
  }, [timerLeft])

  useEffect(() => {
    const handler = (event: KeyboardEvent) => event.key === 'Escape' && onClose()
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const formatTimer = (seconds: number) => `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`

  const next = () => {
    if (stepIndex === recipe.steps.length - 1) {
      writeStorage(`kaifan.progress.${recipe.id}`, 0)
      setFinished(true)
      onComplete()
    } else {
      setStepIndex((value) => value + 1)
    }
  }

  if (finished) {
    return (
      <div className="cook-mode cook-mode--finished" role="dialog" aria-modal="true">
        <div className="confetti confetti--one" />
        <div className="confetti confetti--two" />
        <div className="confetti confetti--three" />
        <div className="finished-card">
          <div className="finished-icon"><Check size={38} /></div>
          <p className="eyebrow">完成啦</p>
          <h2>{recipe.title}，开饭！</h2>
          <p>你完成了 {recipe.steps.length} 个步骤。趁热吃，味道最好。</p>
          <FoodVisual recipe={recipe} compact />
          <button className="primary-action" onClick={onClose}>回到推荐菜单</button>
        </div>
      </div>
    )
  }

  return (
    <div className="cook-mode" role="dialog" aria-modal="true" aria-label={`${recipe.title}烹饪模式`}>
      <header className="cook-header">
        <button className="round-button round-button--light" onClick={onClose} aria-label="退出烹饪模式"><X size={20} /></button>
        <div><span>正在做</span><strong>{recipe.title}</strong></div>
        <button
          className={`round-button round-button--light${voiceOn ? ' is-on' : ''}`}
          onClick={() => setVoiceOn((value) => !value)}
          aria-label={voiceOn ? '关闭语音提示' : '开启语音提示'}
        >
          {voiceOn ? <Volume2 size={19} /> : <VolumeX size={19} />}
        </button>
      </header>
      <div className="cook-progress-wrap">
        <div className="cook-progress-label"><span>第 {stepIndex + 1} / {recipe.steps.length} 步</span><span>{Math.round((stepIndex + 1) / recipe.steps.length * 100)}%</span></div>
        <div className="cook-progress"><span style={{ width: `${(stepIndex + 1) / recipe.steps.length * 100}%` }} /></div>
      </div>

      <main className="cook-main">
        <div className="cook-step-number">{String(stepIndex + 1).padStart(2, '0')}</div>
        <div className="cook-step-card">
          {step.image && (
            <figure className="cook-step-media">
              <img src={step.image} alt={step.imageAlt ?? `${step.title}示意图`} />
              {step.imageKind === 'ai-generated' && <figcaption><Sparkles size={13} /> AI 步骤示意</figcaption>}
            </figure>
          )}
          <div className="cook-step-tags">
            {step.heat && <span><Flame size={15} /> {step.heat}</span>}
            {step.timerSeconds && <span><Clock3 size={15} /> 约 {Math.ceil(step.timerSeconds / 60)} 分钟</span>}
          </div>
          <p className="eyebrow">当前步骤</p>
          <h2>{step.title}</h2>
          <p className="cook-instruction">{step.text}</p>
          {step.tip && <div className="cook-tip"><Sparkles size={17} /><span>{step.tip}</span></div>}
        </div>

        {step.timerSeconds && (
          <div className={`timer-card${timerRunning ? ' timer-card--running' : ''}`}>
            <div>
              <span>本步计时</span>
              <strong>{formatTimer(timerLeft)}</strong>
            </div>
            <div className="timer-actions">
              <button onClick={() => { setTimerLeft(step.timerSeconds ?? 0); setTimerRunning(false) }} aria-label="重置计时"><RotateCcw size={18} /></button>
              <button className="timer-start" onClick={() => setTimerRunning((value) => !value)}>
                <TimerReset size={18} /> {timerRunning ? '暂停' : timerLeft === 0 ? '再计一次' : '开始计时'}
              </button>
            </div>
          </div>
        )}
      </main>

      <footer className="cook-footer">
        <button className="cook-back" onClick={() => setStepIndex((value) => Math.max(0, value - 1))} disabled={stepIndex === 0}>
          <ArrowLeft size={18} /> 上一步
        </button>
        <button className="cook-next" onClick={next}>
          {stepIndex === recipe.steps.length - 1 ? '完成这道菜' : '完成，下一步'} <ArrowRight size={18} />
        </button>
      </footer>
    </div>
  )
}

export default function App() {
  const [view, setView] = useState<View>('discover')
  const [pantry, setPantry] = useState<string[]>(() => readStorage('kaifan.pantry', defaultPantry))
  const [expiring, setExpiring] = useState<string[]>(() => readStorage('kaifan.expiring', ['青椒']))
  const [preferences, setPreferences] = useState<Preferences>(() => readStorage('kaifan.preferences', defaultPreferences))
  const [favorites, setFavorites] = useState<string[]>(() => readStorage('kaifan.favorites', []))
  const [shopping, setShopping] = useState<string[]>(() => readStorage('kaifan.shopping', []))
  const [search, setSearch] = useState('')
  const [activeIngredient, setActiveIngredient] = useState<string | null>(null)
  const [sortMode, setSortMode] = useState<SortMode>('match')
  const [onlyReady, setOnlyReady] = useState(false)
  const [thinking, setThinking] = useState(false)
  const [detail, setDetail] = useState<Recommendation | null>(null)
  const [cooking, setCooking] = useState<Recipe | null>(null)
  const [toast, setToast] = useState('')
  const resultsRef = useRef<HTMLElement>(null)

  useEffect(() => writeStorage('kaifan.pantry', pantry), [pantry])
  useEffect(() => writeStorage('kaifan.expiring', expiring), [expiring])
  useEffect(() => writeStorage('kaifan.preferences', preferences), [preferences])
  useEffect(() => writeStorage('kaifan.favorites', favorites), [favorites])
  useEffect(() => writeStorage('kaifan.shopping', shopping), [shopping])
  useEffect(() => {
    if (!toast) return
    const id = window.setTimeout(() => setToast(''), 2200)
    return () => window.clearTimeout(id)
  }, [toast])

  const ranked = useMemo(
    () => rankRecipes(recipes, pantry, preferences, expiring),
    [pantry, preferences, expiring],
  )

  const recipesForActiveIngredient = useMemo(() => {
    if (!activeIngredient) return ranked
    const query = activeIngredient.toLocaleLowerCase('zh-CN')
    return ranked.filter(({ recipe }) => (
      recipe.title.toLocaleLowerCase('zh-CN').includes(query)
      || query.includes(recipe.title.toLocaleLowerCase('zh-CN'))
      || recipe.ingredients.some((ingredient) => (
        ingredient.name.toLocaleLowerCase('zh-CN').includes(query)
        || query.includes(ingredient.name.toLocaleLowerCase('zh-CN'))
        || ingredient.substitutes?.some((substitute) => (
          substitute.toLocaleLowerCase('zh-CN').includes(query) || query.includes(substitute.toLocaleLowerCase('zh-CN'))
        ))
      ))
    ))
  }, [activeIngredient, ranked])

  const visibleRecommendations = useMemo(() => {
    const filtered = onlyReady
      ? recipesForActiveIngredient.filter((item) => item.missingCore.length === 0)
      : [...recipesForActiveIngredient]
    if (sortMode === 'fast') filtered.sort((a, b) => a.recipe.minutes - b.recipe.minutes || b.score - a.score)
    if (sortMode === 'missing') filtered.sort((a, b) => a.missing.length - b.missing.length || b.score - a.score)
    return filtered.slice(0, 8)
  }, [onlyReady, recipesForActiveIngredient, sortMode])

  const readyCount = ranked.filter((item) => item.missingCore.length === 0).length
  const suggestions = search.trim()
    ? Array.from(new Set([
        ...recipes.filter((recipe) => recipe.title.includes(search.trim())).map((recipe) => recipe.title),
        ...allIngredients.filter((item) => item.includes(canonicalizeIngredient(search))),
      ])).filter((item) => !pantry.includes(item)).slice(0, 8)
    : []

  const showToast = (message: string) => setToast(message)

  const addIngredient = (raw: string) => {
    const name = canonicalizeIngredient(raw)
    if (!name) return
    const isDishQuery = recipes.some((recipe) => recipe.title.includes(name)) && !allIngredients.includes(name)
    if (isDishQuery) {
      showToast(`正在查找“${name}”相关菜谱`)
    } else if (pantry.includes(name)) {
      showToast(`${name}已经在冰箱里了`)
    } else {
      setPantry((items) => [...items, name])
      showToast(`已加入 ${name}，正在查找相关菜谱`)
    }
    setActiveIngredient(name)
    setOnlyReady(false)
    setSearch('')
  }

  const removeIngredient = (name: string) => {
    setPantry((items) => items.filter((item) => item !== name))
    setExpiring((items) => items.filter((item) => item !== name))
    if (activeIngredient === name) setActiveIngredient(null)
  }

  const clearPantry = () => {
    setPantry([])
    setExpiring([])
    setActiveIngredient(null)
    showToast('已清空演示食材，可以重新输入')
  }

  const toggleTaste = (taste: Taste) => {
    setPreferences((current) => ({
      ...current,
      tastes: current.tastes.includes(taste)
        ? current.tastes.filter((item) => item !== taste)
        : [...current.tastes, taste].slice(-3),
    }))
  }

  const toggleFavorite = (recipe: Recipe) => {
    const isFavorite = favorites.includes(recipe.id)
    setFavorites((items) => isFavorite ? items.filter((id) => id !== recipe.id) : [...items, recipe.id])
    showToast(isFavorite ? '已取消收藏' : `已收藏 ${recipe.title}`)
  }

  const toggleShopping = (name: string) => {
    const isAdded = shopping.includes(name)
    setShopping((items) => isAdded ? items.filter((item) => item !== name) : [...items, name])
    showToast(isAdded ? `已从清单移除 ${name}` : `已加入购物清单：${name}`)
  }

  const generate = () => {
    setThinking(true)
    window.setTimeout(() => {
      setThinking(false)
      resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 650)
  }

  const changeView = (next: View) => {
    setView(next)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const navItems: Array<{ id: View; label: string; icon: typeof Home }> = [
    { id: 'discover', label: '找今晚的菜', icon: Home },
    { id: 'pantry', label: '我的冰箱', icon: Refrigerator },
    { id: 'saved', label: '收藏与清单', icon: Heart },
  ]

  return (
    <div className="app-shell">
      <header className="site-header">
        <button className="brand" onClick={() => changeView('discover')} aria-label="回到冰箱开饭首页">
          <span className="brand__mark"><CookingPot size={21} /></span>
          <span><strong>冰箱开饭</strong><small>有啥做啥，刚刚好</small></span>
        </button>
        <nav className="desktop-nav" aria-label="主导航">
          {navItems.map(({ id, label, icon: Icon }) => (
            <button key={id} className={view === id ? 'is-active' : ''} onClick={() => changeView(id)}>
              <Icon size={17} /> {label}
              {id === 'saved' && (favorites.length + shopping.length > 0) && <b>{favorites.length + shopping.length}</b>}
            </button>
          ))}
        </nav>
        <button className="avatar" aria-label="演示用户">安</button>
      </header>

      {view === 'discover' && (
        <main>
          <section className="hero-section">
            <div className="hero-copy">
              <p className="eyebrow"><Leaf size={15} /> 减少浪费，从今晚这顿饭开始</p>
              <h1>冰箱里有什么，<br /><em>今晚就做什么。</em></h1>
              <p className="hero-subtitle">选出手边的食材和想吃的口味，我们把最合适的菜排在前面，还会告诉你为什么。</p>
              <div className="hero-proof">
                <span><BadgeCheck size={17} /> 推荐有理由</span>
                <span><ListChecks size={17} /> 步骤不跳坑</span>
                <span><Clock3 size={17} /> 用时看得见</span>
              </div>
            </div>
            <div className="hero-orbit" aria-hidden="true">
              <div className="hero-orbit__plate"><span>🍅</span><span>🍳</span><span>🫑</span></div>
              <span className="orbit-chip orbit-chip--one">12 分钟</span>
              <span className="orbit-chip orbit-chip--two">食材全齐</span>
              <span className="orbit-chip orbit-chip--three">98% 匹配</span>
            </div>
          </section>

          <section className="builder-layout" aria-label="生成推荐菜单">
            <div className="builder-card">
              <div className="builder-heading">
                <div><span className="step-number">01</span><div><p className="eyebrow">先看看手边有什么</p><h2>选择现有食材</h2></div></div>
                <div className="builder-tools">
                  {pantry.length > 0 && <button className="quiet-button" onClick={clearPantry}><Trash2 size={15} /> 清空</button>}
                  <button className="quiet-button" onClick={() => changeView('pantry')}><Refrigerator size={16} /> 管理冰箱</button>
                </div>
              </div>

              <div className="ingredient-search-wrap">
                <Search size={19} />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  onKeyDown={(event) => event.key === 'Enter' && addIngredient(search)}
                  placeholder="输入食材或菜名，如：鸡蛋、红烧肉"
                  aria-label="输入食材或菜名"
                />
                {search && <button onClick={() => addIngredient(search)}>查找</button>}
                {suggestions.length > 0 && (
                  <div className="suggestion-menu">
                    {suggestions.map((item) => <button key={item} onClick={() => addIngredient(item)}><Plus size={15} /> {item}</button>)}
                  </div>
                )}
              </div>

              <div className="selected-ingredients" aria-label="已选食材">
                {pantry.map((item) => (
                  <span key={item} className={expiring.includes(item) ? 'is-expiring' : ''}>
                    {item}{expiring.includes(item) && <small>优先吃</small>}
                    <button onClick={() => removeIngredient(item)} aria-label={`移除${item}`}><X size={13} /></button>
                  </span>
                ))}
                {pantry.length === 0 && <p className="empty-inline">还没选食材，先加一两样试试。</p>}
              </div>

              {activeIngredient && (
                <div className={`ingredient-feedback${recipesForActiveIngredient.length === 0 ? ' ingredient-feedback--empty' : ''}`} role="status">
                  {recipesForActiveIngredient.length > 0 ? (
                    <><Search size={15} /><span>已找到 <strong>{recipesForActiveIngredient.length}</strong> 道与“{activeIngredient}”相关的菜，结果已更新。</span><button onClick={() => setActiveIngredient(null)}>恢复综合推荐</button></>
                  ) : (
                    <><ShoppingBasket size={15} /><span>当前 {recipes.length} 道本地菜谱里还没有“{activeIngredient}”。这是菜谱库容量限制，不是输入失败。</span><button onClick={() => setActiveIngredient(null)}>查看可做的菜</button></>
                  )}
                </div>
              )}

              <div className="quick-add">
                <span>快速添加</span>
                {['鸡蛋', '番茄', '土豆', '青椒', '米饭', '豆腐'].filter((item) => !pantry.includes(item)).slice(0, 5).map((item) => (
                  <button key={item} onClick={() => addIngredient(item)}><Plus size={13} /> {item}</button>
                ))}
              </div>

              <div className="builder-divider" />

              <div className="builder-heading builder-heading--taste">
                <div><span className="step-number">02</span><div><p className="eyebrow">再说说今天的胃口</p><h2>想吃什么味道？</h2></div></div>
                <span className="selection-hint">最多选 3 个</span>
              </div>
              <div className="taste-grid">
                {tasteOptions.map((taste) => {
                  const selected = preferences.tastes.includes(taste.value)
                  return (
                    <button key={taste.value} className={selected ? 'is-selected' : ''} onClick={() => toggleTaste(taste.value)} aria-pressed={selected}>
                      <span>{taste.icon}</span><div><strong>{taste.value}</strong><small>{taste.note}</small></div>{selected && <Check size={15} />}
                    </button>
                  )
                })}
              </div>

              <div className="preference-bar">
                <div className="preference-group">
                  <span><Clock3 size={15} /> 最多用时</span>
                  <div className="segment-control">
                    {[15, 30, 45].map((minutes) => (
                      <button key={minutes} className={preferences.maxMinutes === minutes ? 'is-active' : ''} onClick={() => setPreferences((current) => ({ ...current, maxMinutes: minutes }))}>{minutes} 分</button>
                    ))}
                    <button className={preferences.maxMinutes === null ? 'is-active' : ''} onClick={() => setPreferences((current) => ({ ...current, maxMinutes: null }))}>不限</button>
                  </div>
                </div>
                <label className="toggle-line">
                  <span><Leaf size={16} /> 只看素食</span>
                  <input type="checkbox" checked={preferences.vegetarianOnly} onChange={(event) => setPreferences((current) => ({ ...current, vegetarianOnly: event.target.checked }))} />
                  <i />
                </label>
              </div>

              <button className="generate-button" onClick={generate} disabled={thinking}>
                {thinking ? <><span className="spinner" /> 正在搭配今晚的菜…</> : <><Sparkles size={19} /> 看看能做什么 <ArrowRight size={19} /></>}
              </button>
              <p className="generator-note"><BadgeCheck size={14} /> 本次基于 {pantry.length} 样食材、{preferences.tastes.length || '不限'} 种口味匹配</p>
            </div>

            <aside className="fridge-card">
              <div className="fridge-card__header">
                <div><p className="eyebrow">我的冰箱</p><h3>今晚的存货</h3></div>
                <span>{pantry.length} 样</span>
              </div>
              <div className="fridge-illustration">
                <div className="fridge-door">
                  <span className="fridge-handle" />
                  <div className="fridge-shelf fridge-shelf--one"><span>🥚</span><span>🍅</span><span>🫑</span></div>
                  <div className="fridge-shelf fridge-shelf--two"><span>🥔</span><span>🥩</span><span>🍚</span></div>
                </div>
              </div>
              <div className="fridge-insight">
                <span className="fridge-insight__icon"><Leaf size={18} /></span>
                <div><strong>{expiring.length ? `${expiring.join('、')}建议优先吃` : '食材状态看起来不错'}</strong><p>已经为相关菜谱加了推荐分</p></div>
              </div>
              <div className="fridge-stats">
                <div><strong>{readyCount}</strong><span>道菜核心料已齐</span></div>
                <div><strong>{ranked[0]?.score ?? 0}%</strong><span>最高匹配度</span></div>
              </div>
              <button className="fridge-manage" onClick={() => changeView('pantry')}>查看全部食材 <ChevronRight size={16} /></button>
            </aside>
          </section>

          <section className="results-section" ref={resultsRef}>
            <div className="results-header">
              <div>
                <p className="eyebrow"><Sparkles size={14} /> 为你排好了</p>
                <h2>{activeIngredient ? `与“${activeIngredient}”相关的菜` : '今晚可以做这些'}</h2>
                <p>{activeIngredient
                  ? recipesForActiveIngredient.length > 0
                    ? `找到 ${recipesForActiveIngredient.length} 道相关菜谱，已按现有食材和口味排序。`
                    : `输入已收到，但演示菜谱库暂时没有使用“${activeIngredient}”的菜。`
                  : `用现有食材，${readyCount} 道菜的核心材料已经齐了。`}</p>
              </div>
              <div className="results-controls">
                <label className="compact-toggle">
                  <input type="checkbox" checked={onlyReady} onChange={(event) => setOnlyReady(event.target.checked)} />
                  <i /> 只看无需补主料
                </label>
                <div className="sort-control">
                  <SlidersHorizontal size={15} />
                  <select value={sortMode} onChange={(event) => setSortMode(event.target.value as SortMode)} aria-label="菜谱排序">
                    <option value="match">综合匹配</option>
                    <option value="fast">最快出锅</option>
                    <option value="missing">缺料最少</option>
                  </select>
                </div>
              </div>
            </div>
            {visibleRecommendations.length > 0 ? (
              <div className="recipe-grid">
                {visibleRecommendations.map((item) => (
                  <RecipeCard
                    key={item.recipe.id}
                    item={item}
                    favorite={favorites.includes(item.recipe.id)}
                    onFavorite={() => toggleFavorite(item.recipe)}
                    onOpen={() => setDetail(item)}
                  />
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <ShoppingBasket size={35} />
                <h3>{activeIngredient ? `菜谱库暂时没有“${activeIngredient}”` : '暂时没有完全匹配的菜'}</h3>
                <p>{activeIngredient
                  ? `输入已经生效。当前版本有 ${recipes.length} 道离线菜谱，正式版还可以继续导入更多书籍或接入在线生成服务。`
                  : '关掉“只看无需补主料”，我们会给你一些只差一两样食材的灵感。'}</p>
                <button onClick={() => activeIngredient ? setActiveIngredient(null) : setOnlyReady(false)}>{activeIngredient ? '返回综合推荐' : '看看更多灵感'}</button>
              </div>
            )}
          </section>
        </main>
      )}

      {view === 'pantry' && (
        <main className="page-main">
          <section className="page-intro">
            <div><p className="eyebrow"><Refrigerator size={15} /> Pantry</p><h1>我的冰箱</h1><p>记录常用食材，下一次打开就能直接得到推荐。</p></div>
            <div className="page-intro__stat"><strong>{pantry.length}</strong><span>样现有食材</span></div>
          </section>
          <section className="pantry-layout">
            <div className="pantry-main-card">
              <div className="section-heading">
                <div><p className="eyebrow">点击即可增减</p><h2>食材分类</h2></div>
                <div className="ingredient-search-wrap ingredient-search-wrap--small"><Search size={17} /><input value={search} onChange={(event) => setSearch(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && addIngredient(search)} placeholder="输入其他食材" />{search && <button onClick={() => addIngredient(search)}>确认</button>}</div>
              </div>
              <div className="ingredient-groups">
                {ingredientGroups.map((group) => (
                  <div className="ingredient-group" key={group.name}>
                    <h3>{group.name}</h3>
                    <div>
                      {group.items.map((item) => {
                        const selected = pantry.includes(item)
                        return <button key={item} className={selected ? 'is-selected' : ''} onClick={() => selected ? removeIngredient(item) : addIngredient(item)} aria-pressed={selected}><span>{selected ? <Check size={15} /> : <Plus size={15} />}</span>{item}</button>
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <aside className="pantry-side-card">
              <div className="section-heading"><div><p className="eyebrow">已选 {pantry.length} 样</p><h2>现有食材</h2></div></div>
              <p className="pantry-help">标记“优先吃”，包含它的菜会排得更靠前。</p>
              <div className="pantry-list">
                {pantry.map((item) => (
                  <div key={item}>
                    <span className="pantry-item-icon">{item.slice(0, 1)}</span>
                    <strong>{item}</strong>
                    <button className={expiring.includes(item) ? 'is-expiring' : ''} onClick={() => setExpiring((items) => items.includes(item) ? items.filter((value) => value !== item) : [...items, item])}><Clock3 size={14} /> {expiring.includes(item) ? '优先吃' : '状态好'}</button>
                    <button className="delete-button" onClick={() => removeIngredient(item)} aria-label={`删除${item}`}><Trash2 size={15} /></button>
                  </div>
                ))}
                {pantry.length === 0 && <div className="empty-mini"><PackageCheck size={28} /><p>冰箱还是空的，先从左边选几样。</p></div>}
              </div>
              <label className="seasoning-card">
                <span><CookingPot size={18} /></span>
                <div><strong>基础调料都有</strong><small>{basicSeasonings.slice(0, 5).join('、')}…</small></div>
                <input type="checkbox" checked={preferences.seasoningsReady} onChange={(event) => setPreferences((current) => ({ ...current, seasoningsReady: event.target.checked }))} />
                <i />
              </label>
              <button className="primary-action pantry-done" onClick={() => changeView('discover')}>用这些食材找菜 <ArrowRight size={17} /></button>
            </aside>
          </section>
        </main>
      )}

      {view === 'saved' && (
        <main className="page-main">
          <section className="page-intro">
            <div><p className="eyebrow"><Heart size={15} /> Saved</p><h1>收藏与清单</h1><p>想做的菜和缺少的食材，都放在这里。</p></div>
            <div className="page-intro__stat"><strong>{favorites.length + shopping.length}</strong><span>条已保存</span></div>
          </section>
          <section className="saved-layout">
            <div className="saved-recipes">
              <div className="section-heading"><div><p className="eyebrow">下次继续做</p><h2>收藏菜谱</h2></div><span>{favorites.length} 道</span></div>
              {favorites.length > 0 ? (
                <div className="recipe-grid recipe-grid--saved">
                  {ranked.filter((item) => favorites.includes(item.recipe.id)).map((item) => (
                    <RecipeCard key={item.recipe.id} item={item} favorite onFavorite={() => toggleFavorite(item.recipe)} onOpen={() => setDetail(item)} />
                  ))}
                </div>
              ) : (
                <div className="empty-state"><Heart size={34} /><h3>还没有收藏</h3><p>遇到想做的菜，点一下心形就会放到这里。</p><button onClick={() => changeView('discover')}>去看看推荐</button></div>
              )}
            </div>
            <aside className="shopping-card">
              <div className="shopping-card__top"><span><ShoppingBasket size={20} /></span><div><p className="eyebrow">买齐就能做</p><h2>购物清单</h2></div><b>{shopping.length}</b></div>
              <div className="shopping-list">
                {shopping.map((item) => (
                  <label key={item}><input type="checkbox" onChange={() => toggleShopping(item)} /><i><Check size={13} /></i><span>{item}</span><button onClick={(event) => { event.preventDefault(); toggleShopping(item) }} aria-label={`移除${item}`}><X size={15} /></button></label>
                ))}
                {shopping.length === 0 && <div className="empty-mini"><ShoppingBasket size={28} /><p>菜谱里点“补买”，食材会自动出现在这里。</p></div>}
              </div>
              {shopping.length > 0 && <button className="clear-shopping" onClick={() => setShopping([])}><Trash2 size={15} /> 清空清单</button>}
            </aside>
          </section>
        </main>
      )}

      <nav className="mobile-nav" aria-label="移动端主导航">
        {navItems.map(({ id, label, icon: Icon }) => (
          <button key={id} className={view === id ? 'is-active' : ''} onClick={() => changeView(id)}><Icon size={20} /><span>{label.replace('今晚的', '')}</span>{id === 'saved' && (favorites.length + shopping.length > 0) && <b>{favorites.length + shopping.length}</b>}</button>
        ))}
      </nav>

      {toast && <div className="toast" role="status"><CircleCheck size={17} /> {toast}</div>}
      {detail && <RecipeDetail item={detail} pantry={pantry} shopping={shopping} onToggleShopping={toggleShopping} onClose={() => setDetail(null)} onCook={(recipe) => { setDetail(null); setCooking(recipe) }} />}
      {cooking && <CookingMode recipe={cooking} onClose={() => setCooking(null)} onComplete={() => { if (!favorites.includes(cooking.id)) setFavorites((items) => [...items, cooking.id]); showToast(`完成 ${cooking.title}，已帮你收藏`) }} />}
    </div>
  )
}
