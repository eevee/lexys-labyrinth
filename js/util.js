export function random_choice(list) {
    return list[Math.floor(Math.random() * list.length)];
}

export function mk(tag_selector, ...children) {
    let [tag, ...classes] = tag_selector.split('.');
    let el = document.createElement(tag);
    el.classList = classes.join(' ');
    if (children.length > 0) {
        if (!(children[0] instanceof Node) && children[0] !== undefined && typeof(children[0]) !== "string" && typeof(children[0]) !== "number") {
            let [attrs] = children.splice(0, 1);
            for (let [key, value] of Object.entries(attrs)) {
                el.setAttribute(key, value);
            }
        }
        el.append(...children);
    }
    return el;
}

export function promise_event(element, success_event, failure_event) {
    let resolve, reject;
    let promise = new Promise((res, rej) => {
        resolve = res;
        reject = rej;
    });

    let success_handler = e => {
        element.removeEventListener(success_event, success_handler);
        if (failure_event) {
            element.removeEventListener(failure_event, failure_handler);
        }

        resolve(e);
    };
    let failure_handler = e => {
        element.removeEventListener(success_event, success_handler);
        if (failure_event) {
            element.removeEventListener(failure_event, failure_handler);
        }

        reject(e);
    };

    element.addEventListener(success_event, success_handler);
    if (failure_event) {
        element.addEventListener(failure_event, failure_handler);
    }

    return promise;
}

export async function fetch(url) {
    let xhr = new XMLHttpRequest;
    let promise = promise_event(xhr, 'load', 'error');
    xhr.open('GET', url);
    xhr.responseType = 'arraybuffer';
    xhr.send();
    await promise;
    return xhr.response;
}

// Cast a line through a grid and yield every cell it touches
export function* walk_grid(x0, y0, x1, y1) {
    // TODO if the ray starts outside the grid (extremely unlikely), we should
    // find the point where it ENTERS the grid, otherwise the 'while'
    // conditions below will stop immediately
    let a = Math.floor(x0);
    let b = Math.floor(y0);

    let dx = x1 - x0;
    let dy = y1 - y0;
    if (dx === 0 && dy === 0) {
        // Special case: the ray goes nowhere, so only return this block
        yield [a, b];
        return;
    }

    let goal_x = Math.floor(x1);
    let goal_y = Math.floor(y1);

    // Use a modified Bresenham.  Use mirroring to move everything into the
    // first quadrant, then split it into two octants depending on whether dx
    // or dy increases faster, and call that the main axis.  Track an "error"
    // value, which is the (negative) distance between the ray and the next
    // grid line parallel to the main axis, but scaled up by dx.  Every
    // iteration, we move one cell along the main axis and increase the error
    // value by dy (the ray's slope, scaled up by dx); when it becomes
    // positive, we can subtract dx (1) and move one cell along the minor axis
    // as well.  Since the main axis is the faster one, we'll never traverse
    // more than one cell on the minor axis for one cell on the main axis, and
    // this readily provides every cell the ray hits in order.
    // Based on: http://www.idav.ucdavis.edu/education/GraphicsNotes/Bresenhams-Algorithm/Bresenhams-Algorithm.html

    // Setup: map to the first quadrant.  The "offsets" are the distance
    // between the starting point and the next grid point.
    let step_a = 1;
    let offset_x = 1 - (x0 - a);
    if (dx < 0) {
        dx = -dx;
        step_a = -step_a;
        offset_x = 1 - offset_x;
    }
    // Zero offset means we're on a grid line, so we're actually a full cell
    // away from the next grid line
    if (offset_x === 0) {
        offset_x = 1;
    }
    let step_b = 1;
    let offset_y = 1 - (y0  - b);
    if (dy < 0) {
        dy = -dy;
        step_b = -step_b;
        offset_y = 1 - offset_y;
    }
    if (offset_y === 0) {
        offset_y = 1;
    }

    let err = dy * offset_x - dx * offset_y;

    let min_a = 0, min_b = 0;
    // TODO get these passed in fool
    let max_a = 31, max_b = 31;
    if (dx > dy) {
        // Main axis is x/a
        while (min_a <= a && a <= max_a && min_b <= b && b <= max_b) {
            yield [a, b];
            if (a === goal_x && b === goal_y)
                return;

            if (err > 0) {
                err -= dx;
                b += step_b;
                yield [a, b];
                if (a === goal_x && b === goal_y)
                    return;
            }
            err += dy;
            a += step_a;
        }
    }
    else {
        err = -err;
        // Main axis is y/b
        while (min_a <= a && a <= max_a && min_b <= b && b <= max_b) {
            yield [a, b];
            if (a === goal_x && b === goal_y)
                return;

            if (err > 0) {
                err -= dy;
                a += step_a;
                yield [a, b];
                if (a === goal_x && b === goal_y)
                    return;
            }
            err += dx;
            b += step_b;
        }
    }
}
