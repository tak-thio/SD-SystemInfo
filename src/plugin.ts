import streamDeck from "@elgato/streamdeck";

import { SystemMonitorAction } from "./actions/system-monitor";

// Register the action
streamDeck.actions.registerAction(new SystemMonitorAction());

// Connect to Stream Deck
streamDeck.connect();
