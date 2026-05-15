import { el, clear } from '../ui/dom.js';
import { t } from '../utils/i18n.js';
import { getTodayStats, getStreakData, getWeeklyData, getCompletionRate, getProductiveDay } from '../stats.js';

export async function renderStats(ctx) {
  const { main, db } = ctx;
  clear(main);

  const container = el('div', { class: 'stats' });

  // Load all data in parallel
  const [today, streak, weekly, rate, bestDay] = await Promise.all([
    getTodayStats(db),
    getStreakData(db, 30),
    getWeeklyData(db),
    getCompletionRate(db),
    getProductiveDay(db)
  ]);

  // ── Card 1: Today's Pulse ──
  container.append(card(
    '⚡', t('todayPulse'),
    el('div', { class: 'stats-row' },
      statTile(t('completedLabel') || 'Done', today.completed, '#22c55e'),
      statTile(t('overdueLabel') || 'Overdue', today.overdue, '#ef4444')
    ),
    today.completed > 0 ? el('div', { class: 'stats-insight' },
      `🔥 ${t('streakActive') || 'Streak active'}`
    ) : null
  ));

  // ── Card 2: Streak ──
  container.append(card(
    '🔥', t('streak'),
    el('div', { class: 'stats-streak-header' },
      el('div', { class: 'stats-streak-number' },
        el('span', { class: 'stats-number-lg' }, String(streak.current)),
        el('span', { class: 'stats-label-sm' }, t('currentStreak') || 'Current')
      ),
      el('div', { class: 'stats-streak-number' },
        el('span', { class: 'stats-number-lg' }, String(streak.longest)),
        el('span', { class: 'stats-label-sm' }, t('bestStreak') || 'Best')
      )
    ),
    el('div', { class: 'stats-streak-dots' },
      ...streak.days.map((active, i) => {
        const isToday = i === streak.days.length - 1;
        return el('div', {
          class: `stats-dot${active ? ' active' : ''}${isToday ? ' today' : ''}`,
          title: isToday ? 'Today' : `${active ? 'Completed' : 'No tasks'}`
        });
      })
    ),
    el('div', { class: 'stats-streak-label' }, `← ${t('daysAgo', { n: 30 })}`),
  ));

  // ── Card 3: Weekly Chart ──
  const maxCount = Math.max(...weekly.map(w => w.count), 1);
  container.append(card(
    '📊', t('thisWeek'),
    el('div', { class: 'stats-chart' },
      el('div', { class: 'stats-chart-bars' },
        ...weekly.map((w, i) => el('div', {
          class: 'stats-bar-wrap',
          style: `--h: ${(w.count / maxCount) * 100}%; animation-delay: ${i * 50}ms`
        },
          el('div', { class: 'stats-bar' },
            el('div', { class: 'stats-bar-fill' })
          ),
          el('div', { class: 'stats-bar-label' }, w.day),
          el('div', { class: 'stats-bar-count' }, String(w.count))
        ))
      )
    )
  ));

  // ── Card 4: Overall Progress ──
  const ringColor = rate.percent >= 50 ? '#22c55e' : rate.percent >= 25 ? '#f59e0b' : '#ef4444';
  container.append(card(
    '📈', t('overallProgress'),
    el('div', { class: 'stats-rate' },
      el('div', {
        class: 'stats-ring',
        style: `--pct: ${rate.percent}; --ring-color: ${ringColor}`
      },
        el('span', { class: 'stats-ring-text' }, `${rate.percent}%`)
      ),
      el('div', { class: 'stats-rate-detail' },
        el('div', {}, `${rate.completed} ${t('completedLabel')}`),
        el('div', {}, `${rate.active} ${t('active')}`),
        el('div', {}, `${rate.archived} ${t('archived')}`),
        el('div', {}, `${rate.total} ${t('total')}`)
      )
    ),
    el('div', { class: 'stats-insight' },
      `🏆 ${t('bestDay') || 'Best day'}: ${bestDay.day} — ${bestDay.count} ${t('tasks')}`
    )
  ));

  main.append(container);
}

// ── Helpers ──

function card(icon, title, ...content) {
  return el('div', { class: 'stats-card' },
    el('div', { class: 'stats-card-header' },
      el('span', { class: 'stats-card-icon' }, icon),
      el('span', { class: 'stats-card-title' }, title)
    ),
    ...content.filter(Boolean)
  );
}

function statTile(label, value, color) {
  return el('div', { class: 'stats-tile' },
    el('div', { class: 'stats-tile-value', style: `--tile-color: ${color}` }, String(value)),
    el('div', { class: 'stats-tile-label' }, label)
  );
}
