import { Contract, ethers, providers, Wallet } from "ethers";
import { BADGE_FACET_ABI, CORE_FACET_ABI } from "./abis";
import { DIAMOND_ADDRESS } from "./addresses";
import dotenv from "dotenv";
dotenv.config();
function getTimestamp() {
  return Math.floor(+new Date() / 1000);
}

async function awaitAndFilter(requests: any[]) {
  let result = (await Promise.allSettled(requests))
    .filter((res) => res.status === "fulfilled")
    .map((res: any) => res.value);
  return result;
}

const contracts = {
  core: new Contract(DIAMOND_ADDRESS, CORE_FACET_ABI),
  badge: new Contract(DIAMOND_ADDRESS, BADGE_FACET_ABI),
};
const provider = new providers.JsonRpcProvider(process.env.RPC);
const signer = new Wallet(process.env.PRIVATE_KEY!, provider);

const parseReceipt: any = async (
  transactionHash: string,
  eventName: string,
  contract: Contract
) => {
  let targetEvent;
  const receipt = await provider.getTransactionReceipt(transactionHash);
  // console.log(receipt);
  for (const event of receipt.logs) {
    try {
      const parsedLog = contract.interface.parseLog(event);
      if (parsedLog && parsedLog.name === eventName) {
        targetEvent = parsedLog;
        break;
      }
    } catch (e) {}
  }
  return targetEvent?.args;
};

const completeQuestReceipt = async (questId: any, address: any) => {
  const txData = new ethers.utils.Interface(CORE_FACET_ABI).encodeFunctionData(
    "completeQuest",
    [questId, address]
  );
  const contract = new Contract(DIAMOND_ADDRESS,CORE_FACET_ABI,signer);
  const tx = await contract.completeQuest(questId, address);
  const receipt = await tx.wait();
  // console.log(receipt);
  return receipt;
};
const updateEngageScoresAndCommunity = async (
  db: any,
  groupId: any,
  userAddr: any,
  engageScore: any
) => {
  let user = await db.collection("users").findOne({ address: userAddr.toLowerCase() });
  let engageScoresAndCommunity = user.engageScoresAndCommunity || [];
  let exist = false;
  engageScoresAndCommunity = engageScoresAndCommunity.map((item: any) => {
    if (item.community.id == groupId) {
      exist = true;
      return {
        ...item,
        engageScore: {
          number: (ethers.BigNumber.from(item.engageScore.number).add(engageScore)).toString(),
          unit: "number",
        },
      };
    }
  });
  if (!exist) {
    const group = await db.collection("groups").findOne({ id: groupId });
    engageScoresAndCommunity.push({
      engageScore: {
        number: engageScore.toString(),
        unit: "number",
      },
      community: {
        id: group.id,
        image: group.logo,
        name: group.name,
      },
    });
  }
  await db
    .collection("users")
    .findOneAndUpdate(
      { address: userAddr.toLowerCase() },
      { $set: { engageScoresAndCommunity } },
      { new: true }
    );
};
const updateUserQuests = async (
  db: any,
  questId: any,
  userAddr: any,
  status: any,
  userSubmission: any
) => {
  const user = await db
    .collection("users")
    .findOne({ address: userAddr.toLowerCase() });
  const quest = await db.collection("quests").findOne({ id: questId });
  let quests = user.quests || [];
  let exists = false;
  let raiseError = false;
  quests = quests.map((item: any) => {
    if (item.id == questId) {
      if (item.status == " ACCEPTED") {
        raiseError == true;
      }
      exists = true;
      return {
        ...item,
        status,
        userSubmission,
      };
    }
    return {
      ...item,
    };
  });
  if (!exists) {
    quests.push({
      ...quest,
      status,
      userSubmission,
    });
  }
  if (raiseError) return;
  await db
    .collection("users")
    .findOneAndUpdate(
      { address: userAddr.toLowerCase() },
      { $set: { quests } },
      { new: true }
    );
};
const updateUserBadges = async (db: any, userAddr: any, badgeId: any) => {
  const user = await db
    .collection("users")
    .findOne({ address: userAddr.toLowerCase() });
  const badge = await db.collection("badges").findOne({ id: badgeId });
  let badges = user.badges || [];
  badges.push({
    ...badge
  })
  await db
    .collections("users")
    .findOneAndUpdate(
      { userAddr: userAddr.toLowerCase() },
      { $set: { badges } },
      { new: true }
    );
};
export {
  getTimestamp,
  awaitAndFilter,
  contracts,
  parseReceipt,
  signer,
  completeQuestReceipt,
  updateEngageScoresAndCommunity,
  updateUserQuests,
};
