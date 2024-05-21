import json
import re
import sys


# We're gonna output a map from the standard gamepad to the actual buttons, just like SDL does
# The gamepad api's "standard gamepad", in SDL terms, is:
STANDARD_ORDER = [
    # buttons
    'a',
    'b',
    'x',
    'y',
    'leftshoulder',
    'rightshoulder',
    'lefttrigger',
    'righttrigger',
    'back',
    'start',
    'leftstick',
    'rightstick',
    'dpup',
    'dpdown',
    'dpleft',
    'dpright',
    'guide',
    # axes
    '-leftx',  '+leftx',
    '-lefty',  '+lefty',
    '-rightx', '+rightx',
    '-righty', '+righty',
]

def main(path):
    web_mappings = {}

    with open(path) as f:
        for line in f:
            line = re.sub('#.*', '', line)
            line = line.strip()
            if not line:
                continue

            ident, name, *mapping_strings = line.split(',')
            if ident == 'xinput':
                continue

            vendor1 = ident[10:12] + ident[8:10]
            vendor2 = ident[18:20] + ident[16:18]
            key = f"{vendor1}:{vendor2}"
            # There are a lot of duplicates for different OSes that I assume are largely the same,
            # and I don't have a good idea for reconciling them, so just take the first of each
            if key in web_mappings:
                continue

            mappings = {}
            max_axis_id = -1
            for mapping_string in mapping_strings:
                k, _, v = mapping_string.partition(':')
                if k in ('', 'platform'):
                    continue

                if m := re.fullmatch('b(\d+)', v):
                    v = 'button', int(m.group(1))
                elif m := re.fullmatch('a(\d+)', v):
                    v = 'axis', int(m.group(1)), False
                elif m := re.fullmatch('a(\d+)[~]', v):
                    v = 'axis', int(m.group(1)), True
                elif m := re.fullmatch('[-]a(\d+)', v):
                    v = 'axis', int(m.group(1)), -1
                elif m := re.fullmatch('[+]a(\d+)', v):
                    v = 'axis', int(m.group(1)), +1
                elif m := re.fullmatch('h(\d+)[.](\d+)', v):
                    v = 'hat', int(m.group(1)), int(m.group(2))
                else:
                    v = '???'

                if v[0] == 'axis':
                    max_axis_id = max(max_axis_id, v[1])

                if k in ('leftx', 'lefty', 'rightx', 'righty'):
                    assert v[0] == 'axis' and isinstance(v[2], bool)
                    if v[2]:
                        # swap
                        mappings['-' + k] = v[0], v[1], +1
                        mappings['+' + k] = v[0], v[1], -1
                    else:
                        mappings['-' + k] = v[0], v[1], -1
                        mappings['+' + k] = v[0], v[1], +1
                else:
                    mappings[k] = v

            # Now we know the highest numbered axis, so change hats into axes, praying that there
            # weren't any axes skipped in the mapping
            for control, mapping in mappings.items():
                if mapping[0] == 'hat':
                    h = mapping[1]
                    direction = mapping[2]
                    axis_id = max_axis_id + 1 + h * 2
                    # assume a hat is a combination of two axes, x and y, with x coming first
                    if direction == 1:  # up
                        mappings[control] = 'axis', axis_id + 1, -1
                    elif direction == 4:  # down
                        mappings[control] = 'axis', axis_id + 1, +1
                    elif direction == 8:  # left
                        mappings[control] = 'axis', axis_id, -1
                    elif direction == 2:  # right
                        mappings[control] = 'axis', axis_id, +1
                    else:
                        raise RuntimeError(f"Don't know what to do with hat: {mapping}")


            # And now put them in gamepad api order, in a compact form
            out = []
            for control in STANDARD_ORDER:
                mapping = mappings.get(control)
                if mapping is None:
                    out.append('x')
                    continue

                if mapping[0] == 'button':
                    out.append(f"b{mapping[1]}")
                elif mapping[0] == 'axis':
                    out.append(f"a{mapping[1]}{'-' if mapping[2] < 0 else '+'}")
                else:
                    raise

            web_mappings[key] = ' '.join(out)

    print(json.dumps(web_mappings, indent=4, sort_keys=True))



if __name__ == '__main__':
    main(*sys.argv[1:])
