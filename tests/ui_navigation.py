"""Navigate using the visible menu and contextual planning tabs."""
def navigate(page,view):
 labels={'suivi':'Prévu / Réel','enveloppes':'Enveloppes','objectifs':'Objectifs','recurrences':'Récurrences','calendrier':'Calendrier'}
 target='prevision' if view in labels else view
 button=page.locator(f'.app-shell-nav [data-view="{target}"]')
 if not button.is_visible():
  page.locator('.mobile-navigation-trigger').click()
 button.click()
 if view in labels:
  page.locator('section.view-active .planning-tabs').get_by_role('button',name=labels[view],exact=True).click()
