import "server-only";
import { addDays, dayIn } from "./dates";
import * as repo from "./repo";
import { lexicalEmbedding } from "./text";

/**
 * Sample subject so the app is usable on first run.
 * Chunks are embedded lexically; if a Gemini key is set they're re-embedded on first search.
 */
type SeedQ = Omit<repo.Question, "id" | "topic_id" | "concept_id"> & { concept: number };
type SeedTopic = { title: string; summary: string; slides: [number, string][]; concepts: [string, string][]; questions: SeedQ[] };

const mcq = (concept: number, prompt: string, options: string[], answer: string, hint: string, explanation: string, source_label: string): SeedQ => ({
  type: "mcq", concept, prompt, options, answer, accept: [], hint, explanation, source_label,
});
const tf = (concept: number, prompt: string, answer: boolean, hint: string, explanation: string, source_label: string): SeedQ => ({
  type: "tf", concept, prompt, options: ["true", "false"], answer: String(answer), accept: [], hint, explanation, source_label,
});
const fill = (concept: number, prompt: string, answer: string, accept: string[], hint: string, explanation: string, source_label: string): SeedQ => ({
  type: "fill", concept, prompt, options: [], answer, accept, hint, explanation, source_label,
});
const spot = (concept: number, prompt: string, options: string[], answer: string, hint: string, explanation: string, source_label: string): SeedQ => ({
  type: "spot_error", concept, prompt, options, answer, accept: [], hint, explanation, source_label,
});

const TOPICS: SeedTopic[] = [
  {
    title: "The OSI Model",
    summary: "The seven layers, which devices work at which layer, and how data is encapsulated.",
    slides: [
      [2, "OSI Model Overview\nThe OSI model divides network communication into seven layers. From bottom to top they are Physical, Data Link, Network, Transport, Session, Presentation and Application. Each layer provides services to the layer above it."],
      [3, "Lower Layers\nThe Physical layer transmits raw bits over a medium such as copper, fiber or radio. The Data Link layer frames data and uses MAC addresses to deliver frames on the local network. Switches operate at the Data Link layer."],
      [4, "Network and Transport Layers\nThe Network layer handles logical addressing and routing between networks using IP addresses. Routers operate at the Network layer. The Transport layer provides end-to-end delivery between applications using port numbers."],
      [5, "Encapsulation\nAs data moves down the layers, each layer adds its own header. The PDU is called a segment at the Transport layer, a packet at the Network layer, a frame at the Data Link layer, and bits at the Physical layer."],
    ],
    concepts: [
      ["Seven OSI layers", "Physical, Data Link, Network, Transport, Session, Presentation, Application — bottom to top."],
      ["Devices by layer", "Switches forward frames by MAC address (Data Link); routers route packets by IP address (Network)."],
      ["Encapsulation and PDUs", "Each layer adds a header; the PDU is a segment, packet, frame, then bits going down."],
    ],
    questions: [
      mcq(1, "At which OSI layer do routers make forwarding decisions?", ["Data Link", "Network", "Transport", "Physical"], "Network",
        "What kind of address does a router read: MAC or IP?",
        "Routers route between networks using IP addresses, which is the Network layer's job. Switches use MAC addresses at the Data Link layer — that's the usual mix-up.", "Slide 4"),
      tf(1, "Switches operate at the Network layer because they forward traffic using MAC addresses.", false,
        "Which layer do MAC addresses belong to?",
        "False. MAC addresses are Data Link (Layer 2) addresses, so switches are Layer 2 devices. The Network layer uses IP addresses.", "Slide 3"),
      fill(2, "At the Transport layer, the PDU is called a _____.", "segment", ["segments"],
        "Transport → ?, Network → packet, Data Link → frame.",
        "Going down the stack: segment (Transport), packet (Network), frame (Data Link), bits (Physical).", "Slide 5"),
      spot(0, "The OSI model has seven layers; from bottom to top they are Physical, Network, Data Link, Transport, Session, Presentation and Application.",
        ["seven layers", "Physical, Network, Data Link", "Session, Presentation and Application"], "Physical, Network, Data Link",
        "Check the order of Layers 2 and 3.",
        "Data Link is Layer 2 and Network is Layer 3, so the order is Physical, Data Link, Network.", "Slide 2"),
      mcq(2, "What is the PDU called at the Data Link layer?", ["Segment", "Packet", "Frame", "Bits"], "Frame",
        "The Data Link layer 'frames' data.",
        "The Data Link layer wraps packets into frames. Packet is the Network layer's PDU — one step up.", "Slide 5"),
      fill(0, "The _____ layer transmits raw bits over a medium such as copper, fiber or radio.", "Physical", ["physical layer"],
        "It's the bottom layer — Layer 1.",
        "Layer 1, the Physical layer, deals with raw bits on the medium.", "Slide 3"),
    ],
  },
  {
    title: "TCP vs UDP",
    summary: "Reliable connection-oriented TCP versus fast connectionless UDP, plus ports and sockets.",
    slides: [
      [6, "TCP\nTCP is connection-oriented and establishes a session with a three-way handshake (SYN, SYN-ACK, ACK). TCP guarantees reliable, ordered delivery using sequence numbers, acknowledgments and retransmission. TCP also uses windowing for flow control."],
      [7, "UDP\nUDP is connectionless and does not guarantee delivery or order. UDP has a smaller header (8 bytes) than TCP (20 bytes minimum), so it has less overhead. Applications like DNS queries, VoIP and live video streaming use UDP because speed matters more than retransmission."],
      [8, "Port Numbers\nWell-known ports range from 0 to 1023. HTTP uses TCP port 80, HTTPS uses TCP port 443, and DNS uses port 53. A socket is the combination of an IP address and a port number."],
    ],
    concepts: [
      ["TCP reliability", "Three-way handshake, sequence numbers, acknowledgments, retransmission and windowing."],
      ["UDP trade-offs", "Connectionless, 8-byte header, no delivery guarantee — chosen when speed beats retransmission."],
      ["Ports and sockets", "Well-known ports 0–1023 (HTTP 80, HTTPS 443, DNS 53); socket = IP address + port."],
    ],
    questions: [
      mcq(0, "Which sequence opens a TCP connection?", ["SYN, SYN-ACK, ACK", "SYN, ACK, FIN", "ACK, SYN, SYN-ACK", "SYN, SYN, ACK"], "SYN, SYN-ACK, ACK",
        "The client asks, the server agrees and asks back, the client confirms.",
        "The three-way handshake is SYN → SYN-ACK → ACK. FIN is used to close a connection, not open one.", "Slide 6"),
      tf(1, "UDP retransmits lost datagrams, so DNS queries over UDP never fail.", false,
        "Does UDP guarantee delivery?",
        "False. UDP is connectionless and has no retransmission; if a reply is lost, the application has to retry.", "Slide 7"),
      fill(2, "HTTPS uses TCP port _____.", "443", [],
        "It's not 80 — that's plain HTTP.",
        "HTTPS is TCP 443. HTTP is TCP 80, and DNS is 53.", "Slide 8"),
      spot(1, "UDP is connection-oriented, has an 8-byte header, and is preferred for VoIP because speed matters more than retransmission.",
        ["connection-oriented", "8-byte header", "preferred for VoIP"], "connection-oriented",
        "Which protocol does the handshake?",
        "UDP is connectionless — TCP is the connection-oriented one. The 8-byte header and VoIP use are correct.", "Slide 7"),
      mcq(1, "Why does live video streaming usually use UDP instead of TCP?",
        ["Low overhead matters more than resending late data", "UDP guarantees ordered delivery", "UDP uses the three-way handshake", "TCP can't carry video"],
        "Low overhead matters more than resending late data",
        "What good is a video frame that arrives after its moment has passed?",
        "For live media, a retransmitted frame arrives too late to be useful, so UDP's low overhead wins. Ordered delivery and the handshake are TCP features.", "Slide 7"),
      fill(2, "The combination of an IP address and a port number is called a _____.", "socket", ["sockets"],
        "It's what an application 'plugs into' to talk on the network.",
        "A socket = IP address + port number; it identifies one end of a conversation.", "Slide 8"),
    ],
  },
  {
    title: "IPv4 Addressing",
    summary: "Address structure, private and loopback ranges, and counting usable hosts in a subnet.",
    slides: [
      [9, "IPv4 Basics\nAn IPv4 address is 32 bits long, written as four octets in dotted-decimal notation. The subnet mask separates the network portion from the host portion. Prefix notation such as /24 states how many bits belong to the network."],
      [10, "Private and Special Addresses\nPrivate address ranges are 10.0.0.0/8, 172.16.0.0/12 and 192.168.0.0/16. Private addresses are not routed on the internet and need NAT to reach it. The address 127.0.0.1 is the loopback address used to test the local TCP/IP stack."],
      [11, "Subnetting\nThe number of usable hosts in a subnet is 2^h − 2, where h is the number of host bits. The first address is the network address and the last address is the broadcast address, so neither can be assigned to a host. A /26 subnet has 6 host bits, giving 62 usable hosts."],
    ],
    concepts: [
      ["IPv4 address structure", "32 bits in four octets; the mask or /prefix splits network bits from host bits."],
      ["Private and loopback addresses", "10/8, 172.16/12, 192.168/16 are private and need NAT; 127.0.0.1 is loopback."],
      ["Usable hosts per subnet", "2^h − 2 usable hosts; the network and broadcast addresses can't be assigned."],
    ],
    questions: [
      mcq(2, "How many usable hosts does a /26 subnet have?", ["64", "62", "30", "126"], "62",
        "Count the host bits first: 32 − 26.",
        "32 − 26 = 6 host bits, and 2^6 − 2 = 62. 64 is the trap — it forgets that the network and broadcast addresses can't be used.", "Slide 11"),
      tf(1, "172.20.5.9 is a private IPv4 address.", true,
        "How far does 172.16.0.0/12 reach?",
        "True. 172.16.0.0/12 covers 172.16.0.0 to 172.31.255.255, so 172.20.x.x is private.", "Slide 10"),
      fill(0, "An IPv4 address is _____ bits long.", "32", ["thirty-two", "thirty two"],
        "Four octets × 8 bits.",
        "Four octets of 8 bits each = 32 bits.", "Slide 9"),
      spot(2, "In every subnet, the first address is the network address and the last address is the gateway address, so neither can be assigned to a host.",
        ["first address is the network address", "last address is the gateway address", "neither can be assigned to a host"], "last address is the gateway address",
        "What do you call the address that reaches every host in the subnet?",
        "The last address is the broadcast address, not the gateway. A gateway is a normal host address you assign to the router.", "Slide 11"),
      mcq(1, "What is 127.0.0.1 used for?",
        ["Testing the local TCP/IP stack (loopback)", "Reaching the default gateway", "Broadcasting to the local network", "Private addressing for home networks"],
        "Testing the local TCP/IP stack (loopback)",
        "Traffic sent here never leaves your own machine.",
        "127.0.0.1 is loopback: it tests your own TCP/IP stack. Home networks use private ranges like 192.168.0.0/16 instead.", "Slide 10"),
      fill(1, "Private addresses need _____ to reach the internet.", "NAT", ["network address translation"],
        "It translates private addresses into a public one.",
        "Private ranges aren't routed on the internet, so NAT (Network Address Translation) maps them to a public address.", "Slide 10"),
    ],
  },
];

const TRAPS = `## Look-alikes
- **Switch vs router** — a switch forwards frames by MAC address (Layer 2, Data Link); a router routes packets by IP address (Layer 3, Network). (Slides 3–4)
- **Packet vs frame vs segment** — segment = Transport, packet = Network, frame = Data Link. (Slide 5)
- **TCP vs UDP** — TCP: handshake, ordered, retransmits. UDP: connectionless, 8-byte header, no guarantees. (Slides 6–7)
- **Broadcast vs gateway address** — the broadcast is the *last* address of the subnet; the gateway is an ordinary host address given to the router. (Slide 11)

## Traps
- **"/26 has 64 hosts."** It has 64 *addresses* but 62 *usable hosts* (2^6 − 2). (Slide 11)
- **"UDP is connection-oriented."** No — TCP is. (Slide 7)
- **"HTTPS is port 80."** HTTP is 80; HTTPS is 443. (Slide 8)
- **"All 172.x.x.x addresses are private."** Only 172.16.0.0 – 172.31.255.255. (Slide 10)

## If you remember one thing
- **OSI Model:** Please Do Not Throw Sausage Pizza Away — Physical, Data Link, Network, Transport, Session, Presentation, Application.
- **TCP vs UDP:** reliability costs overhead; pick UDP when late data is useless.
- **IPv4 Addressing:** host bits = 32 − prefix, usable hosts = 2^h − 2.`;

export async function seedSampleSubject(uid: string, tz = "UTC") {
  const exam = addDays(dayIn(tz), 10);
  const subjectId = await repo.createSubject(uid, { name: "Networking Essentials (sample)", color: "#2563EB", exam_date: exam });
  const slides: [number, string][] = [[1, "Networking Essentials\nMidterm Review — sample slides"], ...TOPICS.flatMap((t) => t.slides)];
  const docText = slides.map(([, t]) => t).join("\n\n");
  const docId = await repo.createDocument(uid, subjectId, { filename: "Networking Essentials – midterm slides (sample).pptx", kind: "pptx", storage_path: null, char_count: docText.length });

  let position = 0;
  for (const [ti, t] of TOPICS.entries()) {
    const topicId = await repo.createTopic(uid, subjectId, { title: t.title, summary: t.summary, position: ti });
    const conceptIds: string[] = [];
    for (const [name, description] of t.concepts) conceptIds.push(await repo.createConcept(uid, topicId, { name, description }));
    await repo.insertChunks(
      uid,
      subjectId,
      docId,
      t.slides.map(([n, text]) => ({ topic_id: topicId, source_label: `Slide ${n}`, content: text, position: position++, embedding: lexicalEmbedding(`Slide ${n}\n${text}`), model: "lexical-v1" })),
    );
    for (const qn of t.questions) {
      const { concept, ...rest } = qn;
      await repo.insertQuestion(uid, topicId, { ...rest, concept_id: conceptIds[concept] });
    }
  }
  await repo.saveTraps(uid, subjectId, TRAPS);
  return subjectId;
}
