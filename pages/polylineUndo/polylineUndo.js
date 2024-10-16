import Stack from './stack';
import Konva from "konva";
import { createMachine, interpret } from "xstate";

const stage = new Konva.Stage({
    container: "container",
    width: 400,
    height: 400,
});

// Une couche pour le dessin
const dessin = new Konva.Layer();
// Une couche pour la polyline en cours de construction
const temporaire = new Konva.Layer();
stage.add(dessin);
stage.add(temporaire);

const MAX_POINTS = 10;
let polyline; // La polyline en cours de construction;
const redoButton = document.getElementById("redo");
const undoButton = document.getElementById("undo");


class UndoManager {
    constructor() {
        this.undoStack = new Stack();
        this.redoStack = new Stack();
        this.updateUndoRedoButtons();
    }
    
    execute(command) {
        try {
            command.execute();
            this.undoStack.push(command);
            this.redoStack = new Stack();
            this.updateUndoRedoButtons();
        } catch (e) {
            console.log("erreur!!!!" + e);
        }
    }
    
    undo() {
        if (!this.undoStack.isEmpty()) {
            const command = this.undoStack.pop();
            command.undo();
            this.redoStack.push(command);
            this.updateUndoRedoButtons();
        }
    }

    redo() {
        if (!this.redoStack.isEmpty()) { 
            const command = this.redoStack.pop();
            command.execute();
            this.undoStack.push(command);
            this.updateUndoRedoButtons();
        }
    }

    canUndo() {
        return !this.undoStack.isEmpty();
    }

    canRedo() {
        return !this.redoStack.isEmpty();
    }

    updateUndoRedoButtons() {
        undoButton.disabled= !this.canUndo;
        redoButton.disabled= !this.canRedo;
    }
}

class Command {
    execute() {}
    undo() {}
}

class AddPolylineCommand extends Command {
    constructor(polyline, layer) {
        super();
        this.myLayer = layer;
        this.myPolyline = polyline;
    }

    execute() {
        this.myLayer.add(this.myPolyline);
    }
    undo() {
        this.myPolyline.remove();
    }
}

let undoManager = new UndoManager();

const polylineMachine = createMachine(
    {
        id: "polyLine",
        initial: "idle",
        states: {
            idle: {
                on: {
                    MOUSECLICK: {
                        target: "onePoint",
                        actions: "createLine",
                    },
                },
            },
            onePoint: {
                on: {
                    MOUSECLICK: {
                        target: "manyPoints",
                        actions: "addPoint",
                    },
                    MOUSEMOVE: {
                        actions: "setLastPoint",
                    },
                    Escape: {
                        target: "idle",
                        actions: "abandon",
                    },
                },
            },
            manyPoints: {
                on: {
                    MOUSECLICK: [
                        {
                            actions: "addPoint",
                            cond: "pasPlein",
                        },
                        {
                            target: "idle",
                            actions: ["addPoint", "saveLine"],
                        },
                    ],
                    MOUSEMOVE: {
                        actions: "setLastPoint",
                    },
                    Escape: {
                        target: "idle",
                        actions: "abandon",
                    },
                    Enter: {
                        target: "idle",
                        actions: "saveLine",
                    },
                    Backspace: [
                        {
                            target: "manyPoints",
                            actions: "removeLastPoint",
                            cond: "plusDeDeuxPoints",
                            internal: true,
                        },
                        {
                            target: "onePoint",
                            actions: "removeLastPoint",
                        },
                    ],
                },
            },
        },
    },
    {
        actions: {
            createLine: (context, event) => {
                const pos = stage.getPointerPosition();
                polyline = new Konva.Line({
                    points: [pos.x, pos.y, pos.x, pos.y],
                    stroke: "red",
                    strokeWidth: 2,
                });
                temporaire.add(polyline);
            },
            setLastPoint: (context, event) => {
                const pos = stage.getPointerPosition();
                const currentPoints = polyline.points();
                const size = currentPoints.length;

                const newPoints = currentPoints.slice(0, size - 2);
                polyline.points(newPoints.concat([pos.x, pos.y]));
                temporaire.batchDraw();
            },
            saveLine: (context, event) => {
                polyline.remove();
                const currentPoints = polyline.points();
                const size = currentPoints.length;
                const newPoints = currentPoints.slice(0, size - 2);
                polyline.points(newPoints);
                polyline.stroke("black");
                let command = new AddPolylineCommand(polyline, dessin);
                undoManager.execute(command);
            },
            addPoint: (context, event) => {
                const pos = stage.getPointerPosition();
                const currentPoints = polyline.points();
                const newPoints = [...currentPoints, pos.x, pos.y];
                polyline.points(newPoints);
                temporaire.batchDraw();
            },
            abandon: (context, event) => {
                polyline.remove();
            },
            removeLastPoint: (context, event) => {
                const currentPoints = polyline.points();
                const size = currentPoints.length;
                const provisoire = currentPoints.slice(size - 2, size);
                const oldPoints = currentPoints.slice(0, size - 4);
                polyline.points(oldPoints.concat(provisoire));
                temporaire.batchDraw();
            },
        },
        guards: {
            pasPlein: (context, event) => {
                return polyline.points().length < MAX_POINTS * 2;
            },
            plusDeDeuxPoints: (context, event) => {
                return polyline.points().length > 6;
            },
        },
    }
);

const polylineService = interpret(polylineMachine)
    .onTransition((state) => {
        console.log("Current state:", state.value);
    })
    .start();

stage.on("click", () => {
    polylineService.send("MOUSECLICK");
});

stage.on("mousemove", () => {
    polylineService.send("MOUSEMOVE");
});

window.addEventListener("keydown", (event) => {
    console.log("Key pressed:", event.key);
    polylineService.send(event.key);
});

// bouton Undo
undoButton.addEventListener("click", () => {
    console.log("clicked undooo!!!!");
    undoManager.undo();
});

redoButton.addEventListener("click", () => {
    undoManager.redo();
    console.log("clicked redo !!!!!");
});
