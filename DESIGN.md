# Bounce Inferno

## Game design and production notes

**Current build** — Limbo is playable. Lust is a first route with placeholder art, chapter-specific wind, and its central encounter. Circles III–IX are outlined for future passes.

### Goal and context

Bounce Inferno is a noncommercial browser game that uses the rolling, jumping, and momentum of Bounce Tales to stage Dante’s *Inferno*. The ball takes Dante’s place as a traveler. It asks his questions, listens with his curiosity, and reacts to what he witnesses. Virgil guides the descent. The player’s goal is to reach the next circle and understand something about the people and places along the way.

Each circle is one explorable world. Routes can rise, descend, and loop back around a landmark. Keep the close camera and a single backdrop per circle. Let structures, silhouettes, objects, sound, and the local movement mechanic give each circle its own identity. Use quiet spaces between encounters. Keep the play HUD to the egg count, discoveries, and nearby actions.

### Controls and gameplay rules

| Action | Input | Rule |
| --- | --- | --- |
| Roll | Left / Right or A / D | Momentum carries over slopes and into jumps. The sprite spins with travel and compresses on hard landings. |
| Jump | Space, Up, or W | Push off from a supporting surface. One-way ledges can be jumped through from below. |
| Drop | Down or S | One press drops through the current marked ledge or lift. The next surface can catch the ball. Press again to drop through another ledge. Solid rock supports the ball. |
| Use | E or the touch Use button | Act when a nearby prompt appears. Talk, pull a lever, read an inscription, or enter an exit. E also advances the current conversation. |
| Close / restart | Escape / R | Escape closes a conversation. R resets the current circle. Checkpoints inside a circle recover from falls during normal play. |

- Grounded controls stay consistent between circles. Wind in Lust acts on the airborne ball. Sheltered ground gives players time to stop, judge the next jump, and read.
- Show the cause before a consequence. A pulled lever moves, an opened gate lifts, wind trails indicate the direction of the force, and small chevrons mark drop-through supports.
- Eggs are optional and collected on contact. Use eggs to indicate possible trajectories and reward exploration. The chapter exit has an explicit interaction and uses story or world state to unlock.
- Dialogue starts on stable ground and pauses the world. Give voices a line break when speakers change. Complete the exchange to register its story event. Escaping lets the player revisit it.

### Platform and interaction palette

| Platform or object | Use in play |
| --- | --- |
| Continuous solid slopes | Let the player roll into a jump, read the next shelf, or return to a previously seen route. |
| Thin one-way shelves | Build overlapping routes with visible clearance. Mark their edges with chevrons and place a visible landing below. |
| Spring plants | Turn a fall into a launch. Reserve the highest routes for places where the player can see or infer the destination. |
| Lift | Cycle without a button. Give the ball a flush boarding point and room to ride in either direction. |
| Sheltered alcoves | Provide stable footing for dialogue and a view of the surrounding wind. |
| Levers and portcullis | In Limbo, the shore and fire levers open the castle gate. Give chains and handles a shared visual language. |
| Inscription or relic | Use a small local prompt. The cave relief lights its sixth alcove and makes the rose available once read. |
| Future platform candidates | Tilting stone, moving wind-borne debris, ice, and timed mechanisms can express a later circle once its main routes are playable. |

When laying out a level in JSON, Y increases downward. The ball is 40 logical pixels across. Leave extra space beyond its diameter at tunnels, ledge stacks, and approaches. Each polygon is clockwise, with its walkable top listed first. The rim count covers those top vertices. Mark thin shelves with `oneWay`. Check approaches from both sides, jump clearance, falls with and without momentum, and an escape from each low pocket. Use `public/level.json` for Limbo and `public/lust.json` for Lust.

### Dialogue and adaptation

Use Longfellow’s public-domain translation as the reference. Condense speech into short, readable panels and preserve who says it, what it means, and its place in the encounter. Give Dante’s spoken lines to **Ball**. Keep narration distinct. Use original lines for inscriptions, hints, and memory scenes created for the game.

| Scene | What the player hears or sees |
| --- | --- |
| Limbo, Virgil | He explains who dwells there and includes himself among them. The ball asks whether anyone has ever left and been blessed. Virgil recalls the figure who led souls out. |
| Limbo, the poets’ fire | The ball asks who is honored. Virgil explains their reputation and names Homer, Horace, Ovid, and Lucan. An unnamed voice welcomes Virgil. The group admits the ball as sixth. Keep their private exchange unspoken. |
| Lust, Minos | Minos warns the traveler at the entrance. Virgil answers that the journey is ordained. This is an encounter with a judge, with his tail as the visual symbol of judgment. |
| Lust, Francesca and Paolo | The ball calls to the pair. Francesca speaks of love and their death. At the ball’s question, she tells how reading about Lancelot led to their kiss. Paolo weeps silently. The ball is overcome by pity. |

Primary text appears in [Canto IV](https://en.wikisource.org/wiki/Divine_Comedy_(Longfellow_1867)/Volume_1/Canto_4) and [Canto V](https://en.wikisource.org/wiki/Divine_Comedy_(Longfellow_1867)/Volume_1/Canto_5). Level context appears in [Danteworlds, Circle II](https://danteworlds.laits.utexas.edu/circle2.html).

### Storyline and level plan

| Circle | Story beat | Design direction |
| --- | --- | --- |
| I. Limbo | The valley sighs. Virgil explains the inhabitants’ longing. The poets welcome the ball. The castle opens onto the meadow and the road down. | Playable hub. Shore to the west, fire to the east, castle above, cave and lift below. |
| II. Lust | Minos warns the traveler. The storm carries the souls. Francesca tells her story beside the silent Paolo. The ball falls. | Playable first pass. Start at judgment, descend through exposed ledges or sheltered shelves, seek the pair, then take the lower threshold. |
| III. Gluttony | Cerberus and the ceaseless rain. | Mud and pooled water with usable banks. |
| IV. Avarice | Two groups roll weights against each other. | Opposing slopes and moving burdens. |
| V. Wrath | The Styx and the approach to Dis. | Mud flats, difficult crossings, and a gate in the distance. |
| VI. Heresy | Souls in burning tombs. | Traversal among hot and sheltered stone. |
| VII. Violence | The river, the wood, and the burning plain. | Three connected areas with one coherent backdrop and a distinct obstacle in each. |
| VIII. Fraud | The ten ditches of Malebolge. | Visible bridges and route choices that invite scrutiny. |
| IX. Treachery | The ice of Cocytus and the final passage. | Slippery momentum, stillness, and the turn toward the way out. |

### Symbolism, discoveries, and rewards

| Object or image | Meaning in the game | What the player gains |
| --- | --- | --- |
| Ball | Dante’s role in a body built around momentum and vulnerability. In Lust the same form makes it possible to feel the storm pulling the traveler off course. | A continuous point of view across the circles. |
| Eggs | A visual language inherited from Bounce Tales. Trails mark arcs, landings, or reasons to explore beyond the obvious route. | Pickup effects and the chapter’s collection tally. |
| Fire and seven gates | The light and refuge in Limbo and the seven portals described in Canto IV. The gates mark travel into the meadow. | A readable path and the castle’s physical opening. |
| Sixth alcove and rose | The empty alcove echoes the poet joining the group of five. The cave and the rose are original motifs. The rose can carry the project’s Rosicrucian interest in an image of inward change. | Reading the relief reveals the rose. Collecting it changes Limbo’s last line. Continue directly to Lust and it appears in the HUD and unlocks an optional memory at a sheltered niche for that browser tab. |
| Tail of Minos | In the poem, how many times it coils signals the depth of a soul’s assigned circle. | An environmental cue for judgment and descent. |
| Wind and two doves | The storm makes uncontrolled movement tangible. The pair’s approach recalls Dante’s simile of doves summoned by desire. | The player learns to use shelter, then the motion gives way to listening. |
| Book of Lancelot | A story helps Francesca and Paolo recognize and act on their desire. It also mirrors the game’s interest in how stories affect the people who encounter them. | A visual focal point for Francesca’s story. A separate book interaction is a possible later pass. |

Use Jung’s shadow as an optional design lens for later hidden routes. A detour can surface an uncomfortable part of a story that the main path leaves unexamined. Keep those interpretations in environmental discoveries and optional scenes. Keep rewards narrative or aesthetic so the main route and difficulty still work for players who miss a discovery.

### Asset production

Keep the current painted images as placeholders during layout. Draw replaceable pieces at roughly 3× their intended on-screen size for the 240 × 320 logical view. Use WebP with alpha for sprites and a full rectangular image with room to pan for each background. Preserve object anchors when replacing art. Choose the terrain collision shape in level data.

| Priority | Produce | Implementation or replacement note |
| --- | --- | --- |
| Shared | Ball shell and expressions, egg, pickup stars, checkpoint, prompt and dialogue styling | Current ball and egg use artwork in `public/assets/`. A single painted shell can rotate continuously. |
| Limbo | One ravine backdrop, rock and moss surfaces, spring plant, poet silhouettes, fire, seven gates, lever, relief, rose | Retain the palette and shared stone proportions across the shore, castle, and cave. Supply a lit and dim treatment for the sixth alcove. |
| Lust first art pass | One rough violet storm plate, storm rock, ledges with down chevrons, sheltered threshold and lower passage | The prototype uses the available firelight plate and existing stone, with wind trails as separate foreground animation. Replace the plate through `background` in `lust.json`. |
| Lust characters and symbols | Minos with a silhouette and coiling tail, Francesca speaking, Paolo listening or weeping, two doves, an open book | Block out each silhouette at camera scale. Preserve one visible pose for each important story beat. Make the book recognizable near their feet. |
| Audio | Quiet Limbo ambience, gust loops with stronger exposed sections, wind falloff at the pair, local interaction cues | Prototype pickup and interaction cues are synthesized. Background ambience, place-specific loops, and optional voices are production work. |

### Next Lust passes

1. **Route in the prototype.** Establish entry, wind lanes, marked ledges, a safe listening area, the carry-over rose memory, and the lower exit.
2. **Traversal playtest.** Tune gust strength and spacing with keyboard and touch. Give the player a visible landing, a viable alternate line, and a way to recover after overshooting.
3. **Art and sound.** Replace the Minos, Francesca, and Paolo stand-ins. Add distinct storm rock, the dark violet sky, and local sound that recedes at the encounter.
4. **Story polish.** Time the doves’ approach and Paolo’s silent reaction. Carry the last line into the ball’s fall and stage the cut to Gluttony when that circle is playable.
