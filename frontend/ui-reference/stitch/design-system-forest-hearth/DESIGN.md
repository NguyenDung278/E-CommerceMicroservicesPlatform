# Design System Strategy: The Tactile Editorial

## 1. Overview & Creative North Star
The Creative North Star for this design system is **"The Digital Atelier."** 

We are moving away from the rigid, modular look of standard e-commerce to create an experience that feels like flipping through a high-end fashion or architectural lookbook. This system rejects the "boxed-in" nature of the web. By utilizing intentional asymmetry, expansive whitespace (the "Spacious" directive), and a rejection of structural borders, we create a layout that breathes. 

The goal is to make the user feel like they are interacting with fine paper and glass, rather than a database. We achieve this through "The Layering Principle"—using tonal shifts instead of lines to define space.

---

## 2. Color & Tonal Architecture
This system utilizes a sophisticated palette of Deep Forest and Warm Cream to establish authority and calm.

### The "No-Line" Rule
**Strict Mandate:** Designers are prohibited from using 1px solid borders to define sections or cards. 
Structure must be created through:
*   **Background Shifts:** Use `surface-container-low` (#f5f3ee) for large sections sitting on a `surface` (#fbf9f4) background.
*   **Negative Space:** Use the Spacing Scale (specifically tokens `10` through `16`) to create mental boundaries.

### Surface Hierarchy & Nesting
Treat the UI as a physical stack. 
1.  **Base:** `surface` (#fbf9f4)
2.  **Sectioning:** `surface-container-low` (#f5f3ee) for grouping related content.
3.  **Emphasis:** `surface-container-highest` (#e4e2dd) for high-priority interactive elements.

### Signature Textures: Glass & Gradients
To avoid a flat "template" feel, use a subtle gradient for primary CTAs: 
*   **Primary Action:** Linear gradient from `primary` (#061b0e) to `primary_container` (#1b3022) at a 135° angle.
*   **Glassmorphism:** For floating navigation or quick-view modals, use `surface` at 80% opacity with a `20px` backdrop-blur. This allows the Deep Forest or Terracotta accents to bleed through the background, creating depth.

---

## 3. Typography
The typographic pairing is a study in contrast: the historic weight of Noto Serif against the clinical precision of Inter.

*   **Display & Headlines (Noto Serif):** Used for storytelling and product titles. Use `display-lg` (3.5rem) with tight letter-spacing (-0.02em) to create an editorial "masthead" feel.
*   **UI & Utility (Inter):** All functional elements (labels, buttons, inputs) use Inter. 
*   **The Signature Shift:** Use `tertiary` (Soft Terracotta) for `label-md` when indicating categories or "New Arrivals" to pull the eye through the monochrome layout.

---

## 4. Elevation & Depth
We eschew the standard Material Design shadow logic for a more naturalistic approach.

*   **Tonal Layering:** Instead of a shadow, place a `surface_container_lowest` (#ffffff) card on a `surface_container_low` (#f5f3ee) background. This creates a "lift" that is felt rather than seen.
*   **Ambient Shadows:** For floating elements (Modals/Cart Drawers), use a bespoke shadow: `0 24px 48px -12px rgba(27, 28, 25, 0.08)`. The color is a tinted version of `on_surface` to keep the shadow "warm."
*   **The "Ghost Border" Fallback:** If accessibility requires a border (e.g., in high-contrast modes), use `outline_variant` at **15% opacity**. Never use 100% opacity borders.

---

## 5. Components

### Buttons
*   **Primary:** Deep Forest gradient, `md` (0.75rem) rounded corners. Text is `on_primary` Inter Medium.
*   **Secondary:** No fill. `Ghost Border` (outline-variant at 20%) with `primary` text.
*   **Tertiary:** No background or border. Underlined on hover with a 2px Terracotta stroke.

### Input Fields
*   **Style:** Minimalist. No bounding box. Only a bottom stroke using `outline_variant`. 
*   **Focus State:** The bottom stroke transitions to `primary` (#061b0e) with a 2px weight.

### Cards (Product/Editorial)
*   **Constraint:** No borders, no shadows.
*   **Interaction:** On hover, the image should subtly scale (1.05x) while the background container shifts from `surface` to `surface_container_low`.

### 'DEV ONLY' Indigo Badge
*   **Token:** `secondary` (#575d79) background with `on_secondary` text.
*   **Execution:** Small caps, `label-sm`, 2px tracking, rounded `full`.

### Content Dividers
*   **Prohibited:** Horizontal `<hr>` tags.
*   **Alternative:** Use 80px (Token `16`) of vertical whitespace or a change in background color from `surface` to `surface_container_low`.

---

## 6. Do's and Don'ts

### Do
*   **Do** use asymmetrical margins. A product description might be offset by 2 columns to create an editorial rhythm.
*   **Do** use Terracotta (`tertiary`) sparingly. It is a "spark" color, meant for notifications, price points, or "Add to Cart" hover states.
*   **Do** use the `xl` (1.5rem) corner radius for large image containers to soften the "tech" feel.

### Don't
*   **Don't** use pure black (#000000). Always use `on_surface` (#1b1c19) for text to maintain the warmth of the Cream background.
*   **Don't** crowd the interface. If a screen feels "busy," double the spacing token (e.g., move from `6` to `12`).
*   **Don't** use standard "Drop Shadows." If an element needs to pop, use background color contrast first.