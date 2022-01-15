


BAKED DIRECTIVES DATA STRUCTURE:

directives: {
    // Without '.' it is a TAG directive
    scriptTagLoad: this.component,

    // With '.' it's a attribute directive
    'component.dataPropLoad': this.cparts.component,
}


------



1. DONE ------Asset manager
  - "AssetCPart" ?
  - Base class for Script and Style CPart
  - Allow CParts to export a tag with given content (style or script)


# AssetCPart Mk II

This strategy can more cleanly eliminate all evals during build, including
for Template:

- Use AssetManager
- This gets instantiated per loader (?), and/or globally
- Allows registerFunction that either creates a new function or uses an
  existing registered version
- This allows 1:1 replacement with all "new Function"
- Build thus is focused on prepopulating fetchQ.data and AssetManager

Compiles like:

        Modulo.assets.functions['affd93a'] = function MyComp_Template() { ..
        Modulo.assets.stylesheets['0af9eaf'] = true; // Prevent re-inclusion

Or annotated like:
        /* MyComp <script name="lol"> */ Modulo.assets.functions['x84af3a'] = function MyComp_Script() { ..

        /* </script> */ return ....}

- Then, deduping can be as follows:
    - Replace all instances of "text" with quoted hash in final build
    - If attempt to register text that matches regexp of quoted hash,
      use quoted hash instead for hash

# AssetCPart

  - During build step, "style" goes into a CSS file, "script" goes into JS
  - Script and Style contents in fetchQ cache output get blanked (or maybe
    replaced with newlines to preserve line numbering, or a comment explaining
    the new location)
  - Another idea: Use for Template compilation as well, to prevent ANY eval
    from getting into built JS!
  - Interface could have a "dedupe" and "dedupeReplace"
  - Script format:
    -
      (function (factory, Modulo, loadObj) {





          loadObj.script = {
          }); // what was return before
      })();


  - Another idea: Have "detachedFactoryCallback" as a general utility


- Think about refactoring FactoryCPart and AssetCPart each into a helper
  library, or something, to avoid too many base classes (or maybe just
  assetCPart)











------

# Broad ideas for increased code-use around CParts + templates + build

- Problem:
    - How do we structure different asset requirements? How can we make JS/CSS
      build bundles? How do CParts expose this?
    - Idea 1: CParts can implement a "exportCallback" that accumulates a JS file
    - Idea 2: This could somehow get folded into the < script > and < style >
      tag in the header idea: Basically, a CPart can export a "head depedency",
      that get inserted of the given type. Thus, building is the same as just
      summing together all "exports" or head-dependencies.
    - Idea 3: This feels like this could also somehow get folded into "fast
      reorged builds" (e.g. resurrecting factoryData)
    - Idea 4: For flat

- IDEA: When we get default attrs, refactor Style factory Callback into a
  Template that somehow implements prefixAllSelectors. The Template can be
  overridden.


        // Idea: Use Template interface for Style transformers (so that MTL
        // could be used in a pinch well). Eg if ('transform' in options) {
        // Transfomer().render(renderObj) }
        // TODO: Need to do '<x-' -> '<xa3d2af-' for private components, and do
        // '<x-' -> '<tagPref-' for public components
        // (and remove '<my-')
        //const content = (opts.content || '').replace(/(<\/?)x-/ig, tagPref);
        // TODO -v prefered
        //content = content.replace(/(<\/?)x-/g, tagPref);

    // Possibility matrix:
    // (Note: It's not symmetric due to side-effect of getMatchedNode,
    // specifically ordering of checking child first.)
    // matchedRival    ===  null
    //                              rival
    //                                       !== rival
    // matchedChild                                            false
    //       ===  null  . normal    .  e   . nr=r,r=MR    .   skip R
    //           child  . normal    .  e   .  normal      .   normal
    //       !== child  . c=MC,nc=c .  e   .  skip both   .   r=MR,nr=r...
    //           false  . skip C    .  e   . c=MC,nc=c... .   skip both
    //Modulo.assert(matchedRival ? (matchedRival !== rival) : false, 'Repeated key!');

