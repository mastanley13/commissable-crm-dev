Yep — here’s the **complete breakdown** of what you and Rob discussed around validating the **Deposit Template behavior** for the three buckets:

* **Template Fields**  
* **New Fields**  
* **Exclude**

This is pulled directly from the **03-02-26 meeting transcript** and the **03-02-26 summary**.

---

## **The core intent (why these three buckets exist)**

The mapping system is supposed to **get easier over time**:

* “Template Fields” should grow (eventually mostly complete)  
* “New Fields” should shrink (ideally to near-zero)  
* “Exclude” should shrink (as irrelevant/blank columns stabilize and mappings become known)

Rob spelled it out as: once mappings are saved, **future uploads should not force remapping**, and only truly new/unmapped columns with values should surface as “New Fields.”

---

## **1\) Template Fields — what belongs here**

### **Definition (as discussed)**

**Template Fields \= the vendor’s known mappings** that are already saved and reusable.

### **Key behavior expectation**

Once a field has been successfully mapped and saved (and it’s part of the “known set”), it should show up under **Template Fields** for that vendor so “other people can use it.”

### **Why this matters**

This is the mechanism that turns mapping from “every upload is work” into “mapping is mostly solved for this vendor.”

---

## **2\) New Fields — what belongs here**

### **Definition (as discussed)**

**New Fields \= columns that have values but are not currently in the vendor’s saved template.**

Rob and Strategix clarified the rule:

* **Only new fields with new values that have not been mapped** show up in New Fields.

### **“Auto-template evolution” rule (big one)**

After a user maps and saves a deposit, **any fields from the “New Fields” tab are automatically added to that vendor’s template** for future imports.

That’s the “system gets smarter over time” mechanism.

### **The “Units” example (important edge case)**

You also discussed what happens if a field was previously unknown (like “Units”), and later appears again:

* If it wasn’t saved into the template initially but the system already created/recognized it:  
  * it should show up again in **New Fields**  
  * and should “suggest correctly”  
  * and you debated whether it should **auto-map** (Strategix leans “auto-map it”)

This was specifically about **preventing the system from creating the same “new field” repeatedly** — once a column is recognized, it should behave predictably on later uploads.

---

## **3\) Exclude — what belongs here**

### **Definition (as discussed)**

**Exclude \= everything else.**

More specifically, from the March 2 summary:

* **Fields with null values** OR fields the user manually ignores go to Exclude.

### **The “blank goes to excluded” rule**

Rob explicitly stated:

* If a column is blank (or effectively has no useful values), it should go straight to **Excluded**.

---

## **The success criteria you were trying to validate**

Rob laid out the “ideal steady state” very clearly:

1. **Exclude gets smaller over time**  
2. **New Fields gets smaller toward zero**  
3. **Template Fields becomes fully populated**  
   …until a genuinely new/unseen column appears in a file (new product, new vendor formatting, etc.).

That’s the behavioral validation target.

---

## **Practical validation checklist (what to test in the app)**

Use this as your “pass/fail” verification:

### **A) First-time vendor file (new template)**

* Fields with values but no existing mappings appear in **New Fields**  
* Blank / null columns land in **Exclude**  
* Known base fields appear in **Template Fields** (if you have base defaults)

### **B) After you map \+ Save**

* Those “New Fields” you mapped now appear in **Template Fields** on the next upload for the same vendor

### **C) Second upload of same vendor file**

* **New Fields** should be meaningfully smaller  
* **Exclude** should not balloon unexpectedly  
* Only truly new columns with values show in **New Fields**

### **D) Unknown field repeats (“Units” style)**

* If the system created/recognized the field previously, it should **suggest correctly** and not generate a brand-new duplicate field again

---

If you want, I can convert this into a **single dev ticket** with acceptance criteria \+ edge cases (including the “Units” scenario and the “auto-template evolution” rule), so it’s copy/paste-ready for Hunter.

