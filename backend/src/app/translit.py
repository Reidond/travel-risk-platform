"""Ukrainian-to-Latin transliteration (KMU resolution no. 55, 2010)."""

_TABLE: dict[str, str] = {
    "а": "a", "б": "b", "в": "v", "г": "h", "ґ": "g", "д": "d", "е": "e",
    "є": "ie", "ж": "zh", "з": "z", "и": "y", "і": "i", "ї": "i", "й": "i",
    "к": "k", "л": "l", "м": "m", "н": "n", "о": "o", "п": "p", "р": "r",
    "с": "s", "т": "t", "у": "u", "ф": "f", "х": "kh", "ц": "ts", "ч": "ch",
    "ш": "sh", "щ": "shch", "ь": "", "ю": "iu", "я": "ia", "’": "", "'": "",
    "ʼ": "",
}  # fmt: skip

_WORD_INITIAL: dict[str, str] = {"є": "ye", "ї": "yi", "й": "y", "ю": "yu", "я": "ya"}


def transliterate(text: str) -> str:
    """Transliterate Ukrainian text to Latin per the official 2010 standard."""
    out: list[str] = []
    word_start = True
    prev_lower = ""
    for char in text:
        lower = char.lower()
        if lower == "г" and prev_lower == "з":
            mapped = "gh"  # "зг" -> "zgh" per the standard
        elif word_start and lower in _WORD_INITIAL:
            mapped = _WORD_INITIAL[lower]
        elif lower in _TABLE:
            mapped = _TABLE[lower]
        else:
            out.append(char)
            word_start = not char.isalpha()
            prev_lower = lower
            continue
        if char.isupper():
            mapped = mapped.capitalize()
        out.append(mapped)
        word_start = False
        prev_lower = lower
    return "".join(out)
