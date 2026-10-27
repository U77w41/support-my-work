# Support My Work

A small static page where people can send me a tip over UPI. It draws a QR code for whatever amount they pick, and has a button that opens their UPI app with the payment already filled in.

It's meant to live at `https://u77w41.github.io/support-my-work/`, next to my main site at [u77w41.github.io](https://u77w41.github.io/), and it borrows that site's look (colours, Lato, card style, tag pills) so moving between the two feels like one site.

There's no backend and no build step. It's plain HTML, CSS and JavaScript, so GitHub Pages can serve the folder as it is.

## What it does

- Opens with ₹30 in the amount box and the QR code for ₹30 already drawn.
- Redraws the QR code and updates the "Pay ₹X via UPI App" button on every keystroke.
- Has preset amounts (₹30, ₹50, ₹100, ₹500) that look like the category tags on the blog.
- Checks the amount. An empty box, zero, a negative number, letters, more than two decimals, anything under ₹1 or over ₹1,00,000 shows a short message, and the QR code and button switch off until the amount is fixed.
- Has a copy button for the UPI ID, for people paying from a laptop.
- Has a "Save QR image" button that downloads a PNG. You can't scan your own phone's screen, but most UPI apps can scan a QR code from the gallery.
- Supports light and dark themes, with a toggle in the header. On the first visit it follows the OS setting. After that the choice is saved in `localStorage` under `StackColorScheme`, the same key the main site's Hugo Stack theme uses. Both sites are on the same origin, so switching the theme on one switches it on the other.
- Keeps the QR code on a white tile with black modules in both themes. The script also sizes the code so each module is a whole number of screen pixels, with at least four modules of white margin around it. On-screen codes with fractional module sizes are noticeably harder for phone cameras to read.

## Project structure

```text
support-my-work/
├── index.html              markup, header and footer, icon sprite, theme bootstrap
├── styles.css              light/dark colour tokens, layout, responsive rules
├── script.js               UPI link, QR drawing, validation, copy, download, theme toggle
├── favicon.svg             tab icon; turns light on dark browser themes
├── favicon.ico             fallback tab icon (16, 32 and 48 px) for Safari and older browsers
├── apple-touch-icon.png    icon used when someone adds the page to an iPhone home screen
├── donate-svgrepo-com.svg  original icon the three files above are made from
├── assets/
│   └── avatar.png          header avatar
├── .nojekyll               tells GitHub Pages to skip Jekyll processing
├── LICENSE
└── README.md
```

Every asset and script path is relative, so the page works under the `/support-my-work/` subpath without any changes. Links to the main site use absolute URLs. My name and photo in the header go to the home page, Hire Me goes to the resume, and Anurup goes to `/anurup/`.

## How the payment link is built

```text
upi://pay?pa=ujjwal.chowdhury@federal&pn=Ujjwal%20Chowdhury&am=30.00&cu=INR&tn=support
```

| Parameter | Meaning | Value |
| --- | --- | --- |
| `pa` | Payee UPI ID | `ujjwal.chowdhury@federal` |
| `pn` | Payee name | `Ujjwal Chowdhury` |
| `am` | Amount, two decimals | from the amount box |
| `cu` | Currency | `INR` |
| `tn` | Note | `support` |

The same string goes into the QR code and the button's `href`.

To change the UPI ID, name, note or limits, edit the `CONFIG` object at the top of `script.js`. The ₹30 default also appears in `index.html` (the input's value, the button's `href` and label, and which preset is pressed) so the page is correct before JavaScript runs. If you change the default, change it in both places.

## Linking to a specific amount

`https://u77w41.github.io/support-my-work/?amount=100` opens the page with ₹100 filled in. If the value isn't a valid amount, the page ignores it and uses ₹30.

## Run it locally

```bash
cd support-my-work
python3 -m http.server 8000
# then open http://localhost:8000
```

Opening `index.html` straight from disk also works. A local server is just closer to how GitHub Pages serves it.

## Deploy to GitHub Pages

1. On GitHub, create a new public repository called `support-my-work` under the `u77w41` account. Leave "Add a README file" unchecked, since this folder already has one.

2. Push the project from this folder:

   ```bash
   cd support-my-work
   git init
   git add .
   git commit -m "Add Support My Work page"
   git branch -M main
   git remote add origin https://github.com/u77w41/support-my-work.git
   git push -u origin main
   ```

3. In the repository, go to **Settings → Pages**. Under "Build and deployment", set **Source** to "Deploy from a branch", choose the `main` branch and the `/ (root)` folder, then click **Save**.

4. Give it a minute or two. When the build finishes, the Pages settings show the live address: `https://u77w41.github.io/support-my-work/`. The **Actions** tab shows the deploy if you want to watch it.

5. Open the live page on a phone and send a ₹1 test payment from a different UPI account (many apps won't let you pay your own UPI ID from the same bank account). Check that the right name shows up and the note says `support`.

6. Optional: add a "Support" item to the main site's menu. In a Hugo Stack site this goes in the site config, for example in `hugo.yaml`:

   ```yaml
   menu:
     main:
       - identifier: support
         name: Support
         url: https://u77w41.github.io/support-my-work/
         weight: 50
   ```

   If the config is TOML, the same fields go under `[[menu.main]]`.

Later updates are just commit and push. Pages redeploys on every push to `main`.

## Things to know

- The Pay button only does something on a phone with a UPI app installed. On a laptop, the page tells people to scan the QR code instead.
- iPhones don't show an app picker for `upi://` links. iOS opens whichever installed UPI app registered for the link, which may not be the one the person wanted. The QR code and the copy button cover that case.
- Some UPI apps are stricter about link-initiated payments to personal (non-merchant) UPI IDs and may show a generic error or a limit warning. When that happens, scanning the QR code or typing the UPI ID usually works.
- The QR code comes from [qrcode-generator](https://github.com/kazuhikoarase/qrcode-generator) 1.4.4 (MIT), loaded from cdnjs with a Subresource Integrity hash. If cdnjs is unreachable, `script.js` loads the same library from jsDelivr, also hash-checked. If both fail, the page says so, and the button and UPI ID still work.
- The page uses no bank, UPI app or payment-network logos. Apart from the Anurup mark, the icons are from [Tabler Icons](https://tabler.io/icons) (MIT). All of them live in one inline SVG sprite at the top of `index.html`. The favicon is the "Donate" icon from [SVG Repo](https://www.svgrepo.com/) (`donate-svgrepo-com.svg`), recoloured to the site's slate accent. The avatar is the one from the main site.
- The page doesn't collect or send any data. The browser fetches Lato from Google Fonts and the QR library from cdnjs, and the only thing it stores locally is the theme choice.

## Quick check after editing

- The page loads with ₹30 and a QR code, without touching anything.
- Scanning the QR code in a UPI app shows the right name, amount and the note `support`.
- Typing a new amount changes the button label and the QR code straight away.
- Clearing the box or typing `0` shows the message and disables both.
- The theme toggle works, and the choice survives a reload.
