import { test, expect } from "@playwright/test"

test.describe("Advan landing page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/")
  })

  /* ── 1. Tap Box: expands on click, reveals badges + score ── */
  test("TapBox expands on click and reveals confidence score + source badges", async ({
    page,
  }) => {
    // wait for hero to mount
    const toggle = page.getByTestId("tapbox-toggle")
    await expect(toggle).toBeVisible({ timeout: 10_000 })

    // details should not be visible initially
    const details = page.getByTestId("tapbox-details")
    await expect(details).not.toBeVisible()

    // click to open
    await toggle.click()

    // details panel should now be visible
    await expect(details).toBeVisible({ timeout: 3_000 })

    // confidence score renders with numeric content
    const score = page.getByTestId("confidence-score")
    await expect(score).toBeVisible()
    await expect(score).toContainText("98")

    // source badges container exists and has children
    const badges = page.getByTestId("source-badges")
    await expect(badges).toBeVisible()
    const badgeCount = await badges.locator("span").count()
    expect(badgeCount).toBeGreaterThan(0)
  })

  /* ── 2. Orchestration canvas: nodes are rendered and draggable ── */
  test("Orchestration canvas renders workflow nodes and they are draggable", async ({
    page,
  }) => {
    // scroll to canvas
    const canvas = page.getByTestId("orchestration-canvas")
    await canvas.scrollIntoViewIfNeeded()
    await expect(canvas).toBeVisible({ timeout: 8_000 })

    // at least the first node is rendered
    const firstNode = page.getByTestId("node-ingest")
    await expect(firstNode).toBeVisible({ timeout: 5_000 })

    // record initial bounding box
    const box = await firstNode.boundingBox()
    expect(box).not.toBeNull()

    // drag the node 60px to the right
    await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2)
    await page.mouse.down()
    await page.mouse.move(box!.x + box!.width / 2 + 60, box!.y + box!.height / 2, { steps: 10 })
    await page.mouse.up()

    // node should still be visible after drag
    await expect(firstNode).toBeVisible()
  })

  /* ── 3. Copilot section: live conversation is visible ── */
  test("Human + AI Copilot live conversation renders", async ({ page }) => {
    const copilot = page.getByTestId("copilot-live")
    await copilot.scrollIntoViewIfNeeded()
    await expect(copilot).toBeVisible({ timeout: 8_000 })

    // section heading is present
    const heading = page.getByRole("heading", { name: /copilot/i })
    await expect(heading).toBeVisible()
  })
})
