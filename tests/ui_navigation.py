"""Navigate using the visible menu and contextual planning tabs."""
def navigate(page,view):
 labels={'budgets-libres':'Budgets libres','suivi':'Prévu / Réel','enveloppes':'Enveloppes','objectifs':'Objectifs','recurrences':'Récurrences','calendrier':'Calendrier'}
 target='prevision' if view in labels else view
 button=page.locator(f'.app-shell-nav [data-view="{target}"]')
 if not button.is_visible():
  trigger=page.locator('.mobile-navigation-trigger')
  if trigger.is_visible() and not page.locator('.app-shell-nav').evaluate('(n)=>n.classList.contains("mobile-menu-open")'):trigger.click()
  tools=button.locator('xpath=ancestor::details[@id="s26-tools"]')
  if tools.count() and tools.get_attribute('open') is None:tools.locator(':scope>summary').click()
 button.click()
 if view in labels:
  page.locator('section.view-active .planning-tabs').get_by_role('button',name=labels[view],exact=True).click()


def navigate_legacy(page,view):
 """Exercise the retained audit tools explicitly after the v4 redesign."""
 navigate(page,view)
 identifier={'prevision':'v4-forecast-audit','calendrier':'v4-calendar-audit'}.get(view)
 if identifier:
  detail=page.locator('#'+identifier)
  if detail.count() and detail.get_attribute('open') is None:detail.locator(':scope > summary').click()

def manage_category(page,category_id):
 """Open a compact category row before using its management actions."""
 row=page.locator(f'.category-list-row[data-category-id="{category_id}"]')
 if row.count():
  group=row.locator('xpath=ancestor::details[contains(@class,"v52-category-group")]')
  if group.count() and group.get_attribute('open') is None:group.locator(':scope>summary').click()
  toggle=row.locator('.v52-row-toggle')
  if toggle.count() and toggle.get_attribute('aria-expanded')!='true':toggle.click()
 return row

def header_action(page,name):
 """Header actions move into the tools menu on small screens."""
 action=page.get_by_role('button',name=name,exact=True)
 if page.evaluate('matchMedia("(max-width:760px)").matches') or not action.is_visible():
  trigger=page.locator('.mobile-navigation-trigger')
  if trigger.is_visible() and not page.locator('.app-shell-nav').evaluate('(n)=>n.classList.contains("mobile-menu-open")'):trigger.click()
  tools=page.locator('#s26-tools')
  if tools.get_attribute('open') is None:tools.locator(':scope>summary').click()
 action.click()

def detailed_dashboard(page):
 """Open the retained detailed widgets explicitly instead of the essential home."""
 button=page.locator('#home-mode')
 if button.get_attribute('aria-expanded')!='true':button.click()
 detail=page.locator('#v81-dashboard-details')
 if detail.count() and detail.is_visible() and detail.get_attribute('open') is None:detail.locator(':scope>summary').click()

def transaction_action(page,name):
 """Secondary transaction actions live in the phone options panel."""
 action=page.get_by_role('button',name=name,exact=True)
 options=page.locator('#mobile-transaction-options')
 if not action.is_visible() and options.count() and options.is_visible() and options.get_attribute('open') is None:options.locator(':scope>summary').click()
 action.click()

def set_theme(page,theme):
 """Appearance is in the full menu on a phone and the header on desktop."""
 select=page.get_by_label('Apparence',exact=True)
 if page.evaluate('matchMedia("(max-width:760px)").matches'):
  trigger=page.locator('.mobile-navigation-trigger')
  if trigger.get_attribute('aria-expanded')!='true':trigger.click()
  tools=page.locator('#s26-tools')
  if tools.get_attribute('open') is None:tools.locator(':scope>summary').click()
 select.select_option(theme)
 if page.evaluate('matchMedia("(max-width:760px)").matches') and page.locator('.mobile-navigation-trigger').get_attribute('aria-expanded')=='true':page.locator('.mobile-navigation-trigger').click()

def open_mobile_options(page,identifier):
 panel=page.locator('#'+identifier)
 if panel.count() and panel.is_visible() and panel.get_attribute('open') is None:panel.locator(':scope>summary').click()

def budget_action(page,name):
 action=page.get_by_role('button',name=name,exact=True)
 if not action.is_visible():open_mobile_options(page,'mobile-budget-options')
 action.click()


def manage_envelope(page, identifier=None):
 """Open v13 compact card management without changing its financial actions."""
 selector='.envelope-tile' if identifier is None else f'.envelope-tile[data-envelope-id="{identifier}"]'
 card=page.locator(selector).first
 detail=card.locator('.v13-envelope-detail')
 if detail.count() and detail.get_attribute('open') is None:detail.locator(':scope>summary').click()
 return card
